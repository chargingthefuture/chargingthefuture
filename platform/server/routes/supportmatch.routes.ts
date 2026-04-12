/**
 * SupportMatch routes
 */

import express, { type Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin, isAdminWithCsrf, getUserId } from "../auth";
import { validateCsrfToken } from "../csrf";
import { asyncHandler } from "../errorHandler";
import { validateWithZod } from "../validationErrorFormatter";
import { withDatabaseErrorHandling } from "../databaseErrorHandler";
import { NotFoundError } from "../errors";
import { logAdminAction } from "./shared";
import { z } from "zod";
import {
  insertSupportMatchProfileSchema,
  insertPartnershipSchema,
  insertMessageSchema,
  insertExclusionSchema,
  insertReportSchema,
  insertSupportmatchAnnouncementSchema,
  type User,
  type SupportMatchProfile,
  type Partnership,
  type SupportmatchAnnouncement,
  type Report,
} from "@shared/schema";

export function registerSupportMatchRoutes(app: Express) {
  // SupportMatch Profile routes
  app.get('/api/supportmatch/profile', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const profile = await withDatabaseErrorHandling(
      () => storage.getSupportMatchProfile(userId),
      'getSupportMatchProfile'
    );
    if (!profile) {
      return res.json(null);
    }
    // Get user data to return firstName
    const user = await withDatabaseErrorHandling(
      () => storage.getUser(userId),
      'getUserVerificationForSupportMatchProfile'
    ) as User | undefined;
    const userIsVerified = user?.isVerified || false;
    const userFirstName = user?.firstName || null;
    res.json({ ...profile, userIsVerified, firstName: userFirstName });
  }));

  app.post('/api/supportmatch/profile', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertSupportMatchProfileSchema, {
      ...req.body,
      userId,
    }, 'Invalid profile data');

    const profile = await withDatabaseErrorHandling(
      () => storage.createSupportMatchProfile(validatedData),
      'createSupportMatchProfile'
    );
    res.json(profile);
  }));

  app.put('/api/supportmatch/profile', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const profile = await withDatabaseErrorHandling(
      () => storage.updateSupportMatchProfile(userId, req.body),
      'updateSupportMatchProfile'
    );
    res.json(profile);
  }));

  app.delete('/api/supportmatch/profile', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const { reason } = req.body;
    await withDatabaseErrorHandling(
      () => storage.deleteSupportMatchProfile(userId, reason),
      'deleteSupportMatchProfile'
    );
    res.json({ message: "SupportMatch profile deleted successfully" });
  }));

  // SupportMatch Partnership routes
  app.get('/api/supportmatch/partnership/active', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const partnership = await withDatabaseErrorHandling(
      () => storage.getActivePartnershipByUser(userId),
      'getActivePartnershipByUser'
    );
    res.json(partnership || null);
  }));

  app.get('/api/supportmatch/partnership/history', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const partnerships = await withDatabaseErrorHandling(
      () => storage.getPartnershipHistory(userId),
      'getPartnershipHistory'
    );
    res.json(partnerships);
  }));

  app.get('/api/supportmatch/partnership/:id', isAuthenticated, asyncHandler(async (req, res) => {
    const partnership = await withDatabaseErrorHandling(
      () => storage.getPartnershipById(req.params.id),
      'getPartnershipById'
    );
    if (!partnership) {
      throw new NotFoundError('Partnership', req.params.id);
    }
    res.json(partnership);
  }));

  // SupportMatch Messaging routes
  app.get('/api/supportmatch/messages/:partnershipId', isAuthenticated, asyncHandler(async (req, res) => {
    const messages = await withDatabaseErrorHandling(
      () => storage.getMessagesByPartnership(req.params.partnershipId),
      'getMessagesByPartnership'
    );
    res.json(messages);
  }));

  app.post('/api/supportmatch/messages', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertMessageSchema, {
      ...req.body,
      senderId: userId,
    }, 'Invalid message data');

    const message = await withDatabaseErrorHandling(
      () => storage.createMessage(validatedData),
      'createMessage'
    );
    res.json(message);
  }));

  // SupportMatch Exclusion routes
  app.get('/api/supportmatch/exclusions', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const exclusions = await withDatabaseErrorHandling(
      () => storage.getExclusionsByUser(userId),
      'getExclusionsByUser'
    );
    res.json(exclusions);
  }));

  app.post('/api/supportmatch/exclusions', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertExclusionSchema, {
      ...req.body,
      userId,
    }, 'Invalid exclusion data');

    const exclusion = await withDatabaseErrorHandling(
      () => storage.createExclusion(validatedData),
      'createExclusion'
    );
    res.json(exclusion);
  }));

  app.delete('/api/supportmatch/exclusions/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
    await withDatabaseErrorHandling(
      () => storage.deleteExclusion(req.params.id),
      'deleteExclusion'
    );
    res.json({ message: "Exclusion removed successfully" });
  }));

  // SupportMatch Report routes
  app.post('/api/supportmatch/reports', isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertReportSchema, {
      ...req.body,
      reporterId: userId,
    }, 'Invalid report data');

    const report = await withDatabaseErrorHandling(
      () => storage.createReport(validatedData),
      'createReport'
    );
    res.json(report);
  }));

  // SupportMatch Announcement routes (public)
  app.get('/api/supportmatch/announcements', isAuthenticated, asyncHandler(async (_req, res) => {
    const announcements = await withDatabaseErrorHandling(
      () => storage.getActiveSupportmatchAnnouncements(),
      'getActiveSupportmatchAnnouncements'
    );
    res.json(announcements);
  }));

  // SupportMatch Admin routes
  app.get('/api/supportmatch/admin/stats', isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const stats = await withDatabaseErrorHandling(
      () => storage.getSupportMatchStats(),
      'getSupportMatchStats'
    );
    res.json(stats);
  }));

  app.get('/api/supportmatch/admin/profiles', isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const profiles = await withDatabaseErrorHandling(
      () => storage.getAllSupportMatchProfiles(),
      'getAllSupportMatchProfiles'
    ) as SupportMatchProfile[];
    
    // Enrich profiles with firstName from user table or profile's own firstName for unclaimed
    const profilesWithNames = await Promise.all(profiles.map(async (profile: SupportMatchProfile) => {
      let userFirstName: string | null = null;
      if (profile.userId) {
        const userId = profile.userId;
        const user = await withDatabaseErrorHandling(
          () => storage.getUser(userId),
          'getUserForSupportMatchAdminProfiles'
        ) as User | undefined;
        if (user) {
          userFirstName = user.firstName || null;
        }
      } else {
        // For unclaimed profiles, use profile's own firstName field
        userFirstName = ((profile as any).firstName && (profile as any).firstName.trim()) || null;
      }
      return { ...profile, firstName: userFirstName };
    }));
    
    res.json(profilesWithNames);
  }));

  app.get('/api/supportmatch/admin/partnerships', isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const partnerships = await withDatabaseErrorHandling(
      () => storage.getAllPartnerships(),
      'getAllPartnerships'
    ) as Partnership[];
    
    // Get all unique user IDs
    const userIds = new Set<string>();
    partnerships.forEach(p => {
      if (p.user1Id) userIds.add(p.user1Id);
      if (p.user2Id) userIds.add(p.user2Id);
    });
    
    // Fetch all user data in one query
    const allUsers = userIds.size > 0 ? await withDatabaseErrorHandling(
      async () => {
        const userList = Array.from(userIds);
        const users = await Promise.all(
          userList.map(userId => storage.getUser(userId))
        );
        return users.filter((u): u is User => !!u);
      },
      'getAllUsersForSupportMatchAdminPartnerships'
    ) as User[] : [];
    
    // Create a map of userId -> user data
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    // Enrich partnerships with firstName and lastName for both users
    const partnershipsWithNames = partnerships.map((partnership: Partnership) => {
      const user1 = partnership.user1Id ? userMap.get(partnership.user1Id) : null;
      const user2 = partnership.user2Id ? userMap.get(partnership.user2Id) : null;
      
      return {
        ...partnership,
        user1FirstName: user1?.firstName || null,
        user1LastName: user1?.lastName || null,
        user2FirstName: user2?.firstName || null,
        user2LastName: user2?.lastName || null,
      };
    });
    
    res.json(partnershipsWithNames);
  }));

  app.put('/api/supportmatch/admin/partnerships/:id/status', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const { status } = req.body;
    const validStatuses = ['pending', 'active', 'ended', 'paused'];
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    const partnership = await withDatabaseErrorHandling(
      () => storage.updatePartnershipStatus(req.params.id, status),
      'updatePartnershipStatus'
    ) as Partnership;
    await logAdminAction(
      userId,
      "update_partnership_status",
      "partnership",
      partnership.id,
      { status }
    );
    res.json(partnership);
  }));

  app.post('/api/supportmatch/admin/partnerships/run-matching', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const partnerships = await withDatabaseErrorHandling(
      () => storage.createAlgorithmicMatches(),
      'createAlgorithmicMatches'
    ) as Partnership[];
    await logAdminAction(
      userId,
      "run_algorithmic_matching",
      "partnership",
      undefined,
      { matchesCreated: partnerships.length }
    );
    res.json({
      message: `Successfully created ${partnerships.length} partnership(s)`,
      partnerships,
    });
  }));

  app.get('/api/supportmatch/admin/reports', isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const reports = await withDatabaseErrorHandling(
      () => storage.getAllReports(),
      'getAllReports'
    );
    res.json(reports);
  }));

  app.put('/api/supportmatch/admin/reports/:id/status', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const { status, resolution } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    const report = await withDatabaseErrorHandling(
      () => storage.updateReportStatus(req.params.id, status, resolution),
      'updateReportStatus'
    ) as Report;
    await logAdminAction(
      userId,
      "update_report_status",
      "report",
      report.id,
      { status, resolution }
    );
    res.json(report);
  }));

  app.get('/api/supportmatch/admin/announcements', isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const announcements = await withDatabaseErrorHandling(
      () => storage.getAllSupportmatchAnnouncements(),
      'getAllSupportmatchAnnouncements'
    );
    res.json(announcements);
  }));

  app.post('/api/supportmatch/admin/announcements', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertSupportmatchAnnouncementSchema, req.body, 'Invalid announcement data');

    const announcement = await withDatabaseErrorHandling(
      () => storage.createSupportmatchAnnouncement(validatedData),
      'createSupportmatchAnnouncement'
    ) as SupportmatchAnnouncement;
    
    await logAdminAction(
      userId,
      "create_supportmatch_announcement",
      "announcement",
      announcement.id,
      { title: announcement.title, type: announcement.type }
    );

    res.json(announcement);
  }));

  app.put('/api/supportmatch/admin/announcements/:id', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const validatedData = validateWithZod(insertSupportmatchAnnouncementSchema.partial() as any, req.body, 'Invalid announcement data') as Partial<z.infer<typeof insertSupportmatchAnnouncementSchema>>;
    const announcement = await withDatabaseErrorHandling(
      () => storage.updateSupportmatchAnnouncement(req.params.id, validatedData),
      'updateSupportmatchAnnouncement'
    ) as SupportmatchAnnouncement;
    
    await logAdminAction(
      userId,
      "update_supportmatch_announcement",
      "announcement",
      announcement.id,
      { title: announcement.title }
    );

    res.json(announcement);
  }));

  app.delete('/api/supportmatch/admin/announcements/:id', isAuthenticated, isAdmin, validateCsrfToken, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const announcement = await withDatabaseErrorHandling(
      () => storage.deactivateSupportmatchAnnouncement(req.params.id),
      'deactivateSupportmatchAnnouncement'
    ) as SupportmatchAnnouncement;
    
    await logAdminAction(
      userId,
      "deactivate_announcement",
      "announcement",
      announcement.id
    );

    res.json(announcement);
  }));

}
