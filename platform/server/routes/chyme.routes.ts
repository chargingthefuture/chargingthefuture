/**
 * Chyme routes
 */

import express, { type Express } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { isAuthenticated, isAdmin, isAdminWithCsrf, getUserId } from "../auth";
import { validateCsrfToken } from "../csrf";
import { publicListingLimiter, publicItemLimiter } from "../rateLimiter";
import { asyncHandler } from "../errorHandler";
import { validateWithZod } from "../validationErrorFormatter";
import { withDatabaseErrorHandling } from "../databaseErrorHandler";
import { NotFoundError } from "../errors";
import { logAdminAction } from "./shared";
import { generateChymeToken, getTokenExpirationDate } from "../chymeJwt";
import { logInfo, logWarning, logError } from "../errorLogger";
import { z } from "zod";
import {
  insertChymeAnnouncementSchema,
  type ChymeAnnouncement,
  type User,
  type OTPCode,
} from "@shared/schema";

export function registerChymeRoutes(app: Express) {
  // CHYME ROUTES

  // Chyme Announcement routes (public)
  app.get('/api/chyme/announcements', isAuthenticated, asyncHandler(async (req, res) => {
    const announcements = await withDatabaseErrorHandling(
      () => storage.getActiveChymeAnnouncements(),
      'getActiveChymeAnnouncements'
    );
    res.json(announcements);
  }));

  // Chyme Admin Announcement routes
  app.get('/api/chyme/admin/announcements', isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const announcements = await withDatabaseErrorHandling(
      () => storage.getAllChymeAnnouncements(),
      'getAllChymeAnnouncements'
    );
    res.json(announcements);
  }));

  app.post('/api/chyme/admin/announcements', isAuthenticated, ...isAdminWithCsrf, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertChymeAnnouncementSchema, req.body, 'Invalid announcement data');

    const announcement = await withDatabaseErrorHandling(
      () => storage.createChymeAnnouncement(validatedData),
      'createChymeAnnouncement'
    ) as ChymeAnnouncement;
    
    await logAdminAction(
      userId,
      "create_chyme_announcement",
      "announcement",
      announcement.id,
      { title: announcement.title, type: announcement.type }
    );

    res.json(announcement);
  }));

  app.put('/api/chyme/admin/announcements/:id', isAuthenticated, ...isAdminWithCsrf, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const announcement = await withDatabaseErrorHandling(
      () => storage.updateChymeAnnouncement(req.params.id, req.body),
      'updateChymeAnnouncement'
    ) as ChymeAnnouncement;
    
    await logAdminAction(
      userId,
      "update_chyme_announcement",
      "announcement",
      announcement.id,
      { title: announcement.title }
    );

    res.json(announcement);
  }));

  // Chyme OTP routes for Android app authentication
  // Generate OTP - only for approved users
  app.post('/api/chyme/generate-otp', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    
    // Check if user is approved
    const user = await withDatabaseErrorHandling(
      () => storage.getUser(userId),
      'getUserForOTP'
    ) as User | null;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isApproved && !user.isAdmin) {
      return res.status(403).json({ message: "Only approved users can generate OTP codes" });
    }
    
    // Generate OTP using simple method (6-digit code, expires in 5 minutes)
    const { generateSimpleOTP } = await import('../otp');
    const { code, expiresAt } = generateSimpleOTP();
    
    // Store OTP in database (persistent storage)
    await withDatabaseErrorHandling(
      () => storage.createOTPCode(userId, code, expiresAt),
      'createOTPCode'
    );
    
    // Clean up expired OTPs (background cleanup)
    await withDatabaseErrorHandling(
      () => storage.deleteExpiredOTPCodes(),
      'deleteExpiredOTPCodes'
    );
    
    res.json({ 
      otp: code,
      expiresAt: expiresAt.toISOString(),
      message: "OTP generated successfully. Use this code to sign in to the Android app."
    });
  }));

  // Validate OTP and return auth token
  app.post('/api/chyme/validate-otp', asyncHandler(async (req: any, res) => {
    let { otp } = req.body;
    
    // Normalize OTP: convert to string, trim whitespace, ensure it's exactly 6 digits
    if (otp != null) {
      otp = String(otp).trim();
    }
    
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP format" });
    }
    
    // Find OTP code in database
    const otpRecord = await withDatabaseErrorHandling(
      () => storage.findOTPCodeByCode(otp),
      'findOTPCodeByCode'
    ) as OTPCode | null;
    
    if (!otpRecord) {
      logWarning(`[OTP Validation] No matching OTP found. Received: "${otp}"`, req);
      return res.status(400).json({ message: "Invalid OTP code" });
    }
    
    // Check if OTP has expired
    const now = Date.now();
    const expiresAt = otpRecord.expiresAt.getTime();
    if (expiresAt < now) {
      // Delete expired OTP
      await withDatabaseErrorHandling(
        () => storage.deleteOTPCode(otpRecord.userId),
        'deleteExpiredOTP'
      );
      logWarning(`[OTP Validation] OTP matched but expired for user ${otpRecord.userId}`, req);
      return res.status(400).json({ message: "OTP has expired" });
    }
    
    const userId = otpRecord.userId;
    logInfo(`[OTP Validation] OTP matched successfully for user ${userId}`, req);
    
    // Verify user is still approved
    const user = await withDatabaseErrorHandling(
      () => storage.getUser(userId!),
      'getUserForOTPValidation'
    ) as User | null;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isApproved && !user.isAdmin) {
      // Delete OTP if user is not approved
      await withDatabaseErrorHandling(
        () => storage.deleteOTPCode(userId),
        'deleteOTPForUnapprovedUser'
      );
      return res.status(403).json({ message: "User is not approved" });
    }
    
    // Generate JWT token for Chyme mobile authentication
    const token = generateChymeToken(userId);
    const tokenExpiresAt = getTokenExpirationDate();
    
    // Store token in database for revocation tracking
    await withDatabaseErrorHandling(
      () => storage.createAuthToken(token, userId, tokenExpiresAt),
      'createAuthToken'
    );
    
    // Clean up expired tokens (background cleanup)
    await withDatabaseErrorHandling(
      () => storage.deleteExpiredAuthTokens(),
      'deleteExpiredAuthTokens'
    );
    
    // Remove used OTP
    await withDatabaseErrorHandling(
      () => storage.deleteOTPCode(userId),
      'deleteUsedOTP'
    );
    
    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        quoraProfileUrl: user.quoraProfileUrl,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
        isApproved: user.isApproved
      }
    });
  }));

  // Handle room share link redirects from Android app
  // Android app generates links like /app/chyme/room/:roomId
  // Redirect to /apps/chyme/room/:roomId (with 's' in apps)
  // Note: This route must be registered before the base /app/chyme handler
  app.get('/app/chyme/room/:roomId', asyncHandler(async (req: any, res) => {
    const roomId = req.params.roomId;
    // Redirect to the correct path with 'apps' (plural)
    return res.redirect(`/apps/chyme/room/${roomId}`);
  }));

  // Handle Android app deep link redirects for /app/chyme and /apps/chyme
  // If user is authenticated and on Android, auto-generate mobile auth code and redirect
  // Note: This route must be registered before the SPA catch-all handler
  app.get(['/app/chyme', '/apps/chyme'], asyncHandler(async (req: any, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isAndroid = /Android/i.test(userAgent);
    
    // Only handle Android devices - for others, let SPA handle it
    if (!isAndroid) {
      return next(); // Let SPA catch-all handle it
    }
    
    // For Android, check if authenticated
    // We need to manually check auth since we can't use isAuthenticated middleware
    // (it would redirect/error for unauthenticated, but we want to let SPA handle it)
    try {
      // Try to get auth from request (set by auth middleware if present)
      const userId = req.auth?.userId;
      
      if (!userId) {
        // Not authenticated - let SPA handle it (will show login)
        return next();
      }
      
      // Verify user is approved
      const user = await withDatabaseErrorHandling(
        () => storage.getUser(userId),
        'getUserForMobileAuthRedirect'
      ) as User | null;
      
      if (!user) {
        return next();
      }
      
      if (!user.isApproved && !user.isAdmin) {
        return next();
      }
      
      // Generate a secure 8-character alphanumeric code
      let code = randomBytes(4).toString('hex').toUpperCase(); // Should be exactly 8 characters
      // Ensure code is exactly 8 characters (safety check)
      if (code.length > 8) {
        code = code.substring(0, 8);
      } else if (code.length < 8) {
        // Pad with zeros if somehow shorter (shouldn't happen)
        code = code.padEnd(8, '0');
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store code in database
      await withDatabaseErrorHandling(
        () => storage.createOTPCode(userId, code, expiresAt),
        'createMobileAuthCodeForRedirect'
      );
      
      // Clean up expired codes
      await withDatabaseErrorHandling(
        () => storage.deleteExpiredOTPCodes(),
        'deleteExpiredMobileAuthCodesForRedirect'
      );
      
      // Generate deep link and redirect
      const deepLink = `chyme://auth?code=${code}`;
      
      logInfo(`[Mobile Auth Redirect] Generated code for user ${userId} from Android device, redirecting to deep link`, req);
      
      // Redirect to deep link
      return res.redirect(deepLink);
    } catch (error) {
      // If anything goes wrong, let SPA handle it
      logError(error as Error, req);
      return next();
    }
  }));

  // Generate mobile auth code for deep link authentication
  app.post('/api/chyme/generate-mobile-token', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = req.auth?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Verify user is approved
    const user = await withDatabaseErrorHandling(
      () => storage.getUser(userId),
      'getUserForMobileAuth'
    ) as User | null;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isApproved && !user.isAdmin) {
      return res.status(403).json({ message: "User is not approved" });
    }
    
    // Generate a secure 8-character alphanumeric code
    // randomBytes(4) produces 8 hex characters (4 bytes = 8 hex digits)
    let code = randomBytes(4).toString('hex').toUpperCase();
    
    // 🚨 CRITICAL: Enforce exact 8-character length to prevent database errors
    // This should always be 8, but defensive checks prevent issues
    if (code.length > 8) {
      logWarning(`[Mobile Auth] Generated code too long (${code.length} chars), truncating`, req);
      code = code.substring(0, 8);
    } else if (code.length < 8) {
      // Pad with zeros if somehow shorter (shouldn't happen with randomBytes(4))
      logWarning(`[Mobile Auth] Generated code too short (${code.length} chars), padding`, req);
      code = code.padEnd(8, '0');
    }
    
    // Final validation before storage
    if (code.length !== 8 || !/^[A-F0-9]{8}$/.test(code)) {
      logError(new Error(`[Mobile Auth] Generated code failed validation: length=${code.length}, code=${code}`), req);
      return res.status(500).json({ message: "Failed to generate authentication code" });
    }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store code in database (reuse OTP code storage)
    await withDatabaseErrorHandling(
      () => storage.createOTPCode(userId, code, expiresAt),
      'createMobileAuthCode'
    );
    
    // Clean up expired codes
    await withDatabaseErrorHandling(
      () => storage.deleteExpiredOTPCodes(),
      'deleteExpiredMobileAuthCodes'
    );
    
    // Generate deep link
    const deepLink = `chyme://auth?code=${code}`;
    
    logInfo(`[Mobile Auth] Generated code for user ${userId}, expires at ${expiresAt.toISOString()}`, req);
    
    res.json({
      code,
      deepLink,
      expiresAt: expiresAt.toISOString(),
      expiresIn: 600 // seconds
    });
  }));

  // Validate mobile auth code and return auth token
  app.post('/api/chyme/validate-mobile-code', asyncHandler(async (req: any, res) => {
    let { code } = req.body;
    
    // 🚨 CRITICAL: Normalize and validate code BEFORE database operations
    // This prevents "text value too long" database errors
    if (code != null) {
      code = String(code).trim().toUpperCase();
      // Remove any non-alphanumeric characters (safety for URL-encoded or malformed codes)
      code = code.replace(/[^A-F0-9]/g, '');
    }
    
    // Enforce exact 8-character length - reject if not exactly 8 hex characters
    if (!code || code.length === 0) {
      logWarning(`[Mobile Auth] Empty or null code received`, req);
      return res.status(400).json({ message: "Invalid code format" });
    }
    
    // Validate format: must be exactly 8 uppercase hex characters (input is normalized to uppercase above)
    if (code.length !== 8 || !/^[A-F0-9]{8}$/.test(code)) {
      logWarning(`[Mobile Auth] Invalid code format. Length: ${code.length}, Code: ${code.substring(0, 8)}`, req);
      return res.status(400).json({ message: "Invalid code format" });
    }
    
    // Find code in database
    const codeRecord = await withDatabaseErrorHandling(
      () => storage.findOTPCodeByCode(code),
      'findMobileAuthCodeByCode'
    ) as OTPCode | null;
    
    if (!codeRecord) {
      logWarning(`[Mobile Auth] No matching code found. Received: "${code}"`, req);
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    
    // Check if code has expired
    const now = Date.now();
    const expiresAt = codeRecord.expiresAt.getTime();
    if (expiresAt < now) {
      // Delete expired code
      await withDatabaseErrorHandling(
        () => storage.deleteOTPCode(codeRecord.userId),
        'deleteExpiredMobileAuthCode'
      );
      logWarning(`[Mobile Auth] Code matched but expired for user ${codeRecord.userId}`, req);
      return res.status(400).json({ message: "Code has expired" });
    }
    
    const userId = codeRecord.userId;
    logInfo(`[Mobile Auth] Code matched successfully for user ${userId}`, req);
    
    // Verify user is still approved
    const user = await withDatabaseErrorHandling(
      () => storage.getUser(userId!),
      'getUserForMobileAuthValidation'
    ) as User | undefined;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isApproved && !user.isAdmin) {
      // Delete code if user is not approved
      await withDatabaseErrorHandling(
        () => storage.deleteOTPCode(userId),
        'deleteMobileAuthCodeForUnapprovedUser'
      );
      return res.status(403).json({ message: "User is not approved" });
    }
    
    // Generate JWT token for Chyme mobile authentication
    const token = generateChymeToken(userId);
    const tokenExpiresAt = getTokenExpirationDate();
    
    // Store token in database for revocation tracking
    await withDatabaseErrorHandling(
      () => storage.createAuthToken(token, userId, tokenExpiresAt),
      'createAuthTokenFromMobileCode'
    );
    
    // Clean up expired tokens
    await withDatabaseErrorHandling(
      () => storage.deleteExpiredAuthTokens(),
      'deleteExpiredAuthTokens'
    );
    
    // Remove used code
    await withDatabaseErrorHandling(
      () => storage.deleteOTPCode(userId),
      'deleteUsedMobileAuthCode'
    );
    
    // Return token and user info
    res.json({
      token,
      expiresAt: tokenExpiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        quoraProfileUrl: user.quoraProfileUrl,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
        isApproved: user.isApproved
      }
    });
  }));


}
