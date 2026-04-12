/**
 * SupportMatch Storage Module
 * 
 * Handles all SupportMatch mini-app operations: profiles, partnerships, messages,
 * exclusions, reports, and announcements.
 */

import {
  supportMatchProfiles,
  partnerships,
  messages,
  exclusions,
  reports,
  announcements,
  supportmatchAnnouncements,
  users,
  type SupportMatchProfile,
  type InsertSupportMatchProfile,
  type Partnership,
  type InsertPartnership,
  type Message,
  type InsertMessage,
  type Exclusion,
  type InsertExclusion,
  type Report,
  type InsertReport,
  type Announcement,
  type InsertAnnouncement,
  type SupportmatchAnnouncement,
  type InsertSupportmatchAnnouncement,
} from "@shared/schema";
import { db } from "../../db";
import { eq, and, desc, or, gte, lt, sql, inArray } from "drizzle-orm";
import { NotFoundError } from "../../errors";
import { generateAnonymizedUserId, logProfileDeletion } from "../profile-deletion";

export class SupportMatchStorage {
  // ========================================
  // SUPPORTMATCH PROFILE OPERATIONS
  // ========================================

  async getSupportMatchProfile(userId: string): Promise<SupportMatchProfile | undefined> {
    const [profile] = await db
      .select()
      .from(supportMatchProfiles)
      .where(eq(supportMatchProfiles.userId, userId));
    return profile;
  }
  
  async createSupportMatchProfile(profileData: InsertSupportMatchProfile): Promise<SupportMatchProfile> {
    const [profile] = await db
      .insert(supportMatchProfiles)
      .values(profileData)
      .returning();
    return profile;
  }
  
  async updateSupportMatchProfile(userId: string, profileData: Partial<InsertSupportMatchProfile>): Promise<SupportMatchProfile> {
    const [profile] = await db
      .update(supportMatchProfiles)
      .set({
        ...profileData,
        updatedAt: new Date(),
      })
      .where(eq(supportMatchProfiles.userId, userId))
      .returning();
    return profile;
  }
  
  async getAllActiveSupportMatchProfiles(): Promise<SupportMatchProfile[]> {
    return await db
      .select()
      .from(supportMatchProfiles)
      .where(eq(supportMatchProfiles.isActive, true));
  }
  
  async getAllSupportMatchProfiles(): Promise<SupportMatchProfile[]> {
    return await db
      .select()
      .from(supportMatchProfiles)
      .orderBy(desc(supportMatchProfiles.createdAt));
  }

  // ========================================
  // SUPPORTMATCH PARTNERSHIP OPERATIONS
  // ========================================

  async createPartnership(partnershipData: InsertPartnership): Promise<Partnership> {
    const [partnership] = await db
      .insert(partnerships)
      .values(partnershipData)
      .returning();
    return partnership;
  }
  
  async getPartnershipById(id: string): Promise<Partnership | undefined> {
    const [partnership] = await db
      .select()
      .from(partnerships)
      .where(eq(partnerships.id, id));
    return partnership;
  }
  
  async getActivePartnershipByUser(userId: string): Promise<any | undefined> {
    // First get the active partnership
    const [partnership] = await db
      .select()
      .from(partnerships)
      .where(
        and(
          or(
            eq(partnerships.user1Id, userId),
            eq(partnerships.user2Id, userId)
          ),
          eq(partnerships.status, 'active')
        )
      );
    
    if (!partnership) return undefined;
    
    // Determine which user is the partner
    const partnerId = partnership.user1Id === userId ? partnership.user2Id : partnership.user1Id;
    
    // Get the partner's profile
    const [partnerProfile] = await db
      .select()
      .from(supportMatchProfiles)
      .where(eq(supportMatchProfiles.userId, partnerId));
    
    return {
      ...partnership,
      partnerNickname: 'Unknown Partner', // SupportMatchProfile doesn't have nickname field
      partnerGender: partnerProfile?.gender,
      partnerTimezone: partnerProfile?.timezone,
    };
  }
  
  async getAllPartnerships(): Promise<Partnership[]> {
    return await db
      .select()
      .from(partnerships)
      .orderBy(desc(partnerships.createdAt));
  }
  
  async getPartnershipHistory(userId: string): Promise<(Partnership & { partnerFirstName?: string | null; partnerLastName?: string | null })[]> {
    // Get all partnerships for this user
    const userPartnerships = await db
      .select()
      .from(partnerships)
      .where(
        or(
          eq(partnerships.user1Id, userId),
          eq(partnerships.user2Id, userId)
        )
      )
      .orderBy(desc(partnerships.startDate));

    // Get all unique partner user IDs
    const partnerIds = userPartnerships
      .map(p => p.user1Id === userId ? p.user2Id : p.user1Id)
      .filter((id): id is string => !!id);

    if (partnerIds.length === 0) {
      return userPartnerships.map(p => ({ ...p, partnerFirstName: null, partnerLastName: null }));
    }

    // Fetch all partner user data in one query
    const partnerUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, partnerIds));

    // Create a map of userId -> user data
    const userMap = new Map(partnerUsers.map(u => [u.id, u]));

    // Enrich partnerships with partner user data
    return userPartnerships.map(partnership => {
      const partnerId = partnership.user1Id === userId ? partnership.user2Id : partnership.user1Id;
      const partnerUser = userMap.get(partnerId);

      // Derive a safe, human-friendly first name:
      // - Prefer the explicit firstName field if present
      // - Fall back to the email prefix (before "@") if available
      let derivedFirstName: string | null = null;
      if (partnerUser?.firstName && partnerUser.firstName.trim()) {
        derivedFirstName = partnerUser.firstName.trim();
      } else if (partnerUser?.email) {
        const emailPrefix = partnerUser.email.split("@")[0] || "";
        if (emailPrefix) {
          // Capitalize the first character for nicer display
          derivedFirstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        }
      }

      return {
        ...partnership,
        partnerFirstName: derivedFirstName,
        partnerLastName: partnerUser?.lastName || null,
      };
    });
  }
  
  async updatePartnershipStatus(id: string, status: string): Promise<Partnership> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    // If ending the partnership, set the end date to now
    if (status === 'ended') {
      updateData.endDate = new Date();
    }
    
    const [partnership] = await db
      .update(partnerships)
      .set(updateData)
      .where(eq(partnerships.id, id))
      .returning();
    return partnership;
  }
  
  async createAlgorithmicMatches(): Promise<Partnership[]> {
    // Get all active profiles
    const allProfiles = await this.getAllActiveSupportMatchProfiles();
    
    // Get all active partnerships to filter out already matched users
    const activePartnerships = await db
      .select()
      .from(partnerships)
      .where(eq(partnerships.status, 'active'));
    
    const matchedUserIds = new Set<string>();
    activePartnerships.forEach(p => {
      if (p.user1Id) matchedUserIds.add(p.user1Id);
      if (p.user2Id) matchedUserIds.add(p.user2Id);
    });
    
    // Filter to only unmatched users
    const unmatchedProfiles = allProfiles.filter(p => !matchedUserIds.has(p.userId));
    
    // Get all historical partnerships to check for 6-month cooldown
    // Calculate the date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Get all partnerships that started within the last 6 months
    const recentPartnerships = await db
      .select()
      .from(partnerships)
      .where(gte(partnerships.startDate, sixMonthsAgo));
    
    // Create a map to track recent matches between user pairs
    // Key: sorted user pair (userId1 < userId2), Value: most recent startDate
    const recentMatchesMap = new Map<string, Date>();
    recentPartnerships.forEach(p => {
      // Create a consistent key for the pair (always sort IDs to handle both directions)
      const [id1, id2] = [p.user1Id, p.user2Id].sort();
      const pairKey = `${id1}:${id2}`;
      const existingDate = recentMatchesMap.get(pairKey);
      // Keep the most recent start date for this pair
      if (!existingDate || p.startDate > existingDate) {
        recentMatchesMap.set(pairKey, p.startDate);
      }
    });
    
    // Helper function to check if two users were matched within the last 6 months
    const wereMatchedRecently = (userId1: string, userId2: string): boolean => {
      const [id1, id2] = [userId1, userId2].sort();
      const pairKey = `${id1}:${id2}`;
      const lastMatchDate = recentMatchesMap.get(pairKey);
      if (!lastMatchDate) {
        return false; // Never matched before
      }
      // Check if the last match was within 6 months
      return lastMatchDate >= sixMonthsAgo;
    };
    
    // Get all exclusions
    const allExclusions = await db.select().from(exclusions);
    const exclusionMap = new Map<string, Set<string>>();
    allExclusions.forEach(e => {
      if (!exclusionMap.has(e.userId)) {
        exclusionMap.set(e.userId, new Set());
      }
      exclusionMap.get(e.userId)!.add(e.excludedUserId);
    });
    
    // Helper function to check if two users are compatible
    const areCompatible = (user1: typeof unmatchedProfiles[0], user2: typeof unmatchedProfiles[0]): boolean => {
      // Check if these users were matched within the last 6 months
      if (wereMatchedRecently(user1.userId, user2.userId)) {
        return false;
      }
      
      // Check gender preference compatibility (bidirectional)
      // Options: 'any' (matches any gender) or 'same_gender' (matches only same gender as user)
      const user1GenderMatch = 
        user1.genderPreference === 'any' || 
        (user1.genderPreference === 'same_gender' && user1.gender && user1.gender === user2.gender);
      
      const user2GenderMatch = 
        user2.genderPreference === 'any' || 
        (user2.genderPreference === 'same_gender' && user2.gender && user2.gender === user1.gender);
      
      if (!user1GenderMatch || !user2GenderMatch) {
        return false;
      }
      
      // Check for mutual exclusion
      const user1Excludes = exclusionMap.get(user1.userId);
      const user2Excludes = exclusionMap.get(user2.userId);
      
      if (user1Excludes?.has(user2.userId) || user2Excludes?.has(user1.userId)) {
        return false;
      }
      
      // Timezone compatibility - respect both users' timezone preferences
      const user1WantsSameTimezone = user1.timezonePreference === 'same_timezone';
      const user2WantsSameTimezone = user2.timezonePreference === 'same_timezone';
      
      // If EITHER user requires same timezone matching, enforce timezone constraints
      // This ensures users who want same-timezone partners are never matched across timezones,
      // regardless of their potential partner's preference
      if (user1WantsSameTimezone || user2WantsSameTimezone) {
        // Both users must have a timezone set
        if (!user1.timezone || !user2.timezone) {
          return false;
        }
        // Timezones must match exactly
        if (user1.timezone !== user2.timezone) {
          return false;
        }
      }
      
      return true;
    };
    
    // Create matches using a simple greedy algorithm
    const createdPartnerships: Partnership[] = [];
    const matched = new Set<string>();
    
    for (let i = 0; i < unmatchedProfiles.length; i++) {
      const user1 = unmatchedProfiles[i];
      
      if (matched.has(user1.userId)) {
        continue;
      }
      
      // Find best match for user1
      let bestMatch = null;
      let bestScore = -1;
      
      for (let j = i + 1; j < unmatchedProfiles.length; j++) {
        const user2 = unmatchedProfiles[j];
        
        if (matched.has(user2.userId)) {
          continue;
        }
        
        if (areCompatible(user1, user2)) {
          // Calculate compatibility score
          let score = 0;
          
          // Same timezone is better
          if (user1.timezone && user2.timezone && user1.timezone === user2.timezone) {
            score += 10;
          }
          
          // Specific gender preferences (same_gender) are slightly better than "any"
          if (user1.genderPreference !== 'any' && user2.genderPreference !== 'any') {
            score += 5;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = user2;
          }
        }
      }
      
      // Create partnership if a match was found
      if (bestMatch) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30); // 30 days from start
        
        const partnership = await this.createPartnership({
          user1Id: user1.userId,
          user2Id: bestMatch.userId,
          startDate,
          endDate,
          status: 'active',
        });
        
        createdPartnerships.push(partnership);
        matched.add(user1.userId);
        matched.add(bestMatch.userId);
      }
    }
    
    return createdPartnerships;
  }

  // ========================================
  // SUPPORTMATCH MESSAGE OPERATIONS
  // ========================================

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(messageData)
      .returning();
    return message;
  }
  
  async getMessagesByPartnership(partnershipId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.partnershipId, partnershipId))
      .orderBy(messages.createdAt);
  }

  // ========================================
  // SUPPORTMATCH EXCLUSION OPERATIONS
  // ========================================

  async createExclusion(exclusionData: InsertExclusion): Promise<Exclusion> {
    const [exclusion] = await db
      .insert(exclusions)
      .values(exclusionData)
      .returning();
    return exclusion;
  }
  
  async getExclusionsByUser(userId: string): Promise<Exclusion[]> {
    return await db
      .select()
      .from(exclusions)
      .where(eq(exclusions.userId, userId))
      .orderBy(desc(exclusions.createdAt));
  }
  
  async checkMutualExclusion(user1Id: string, user2Id: string): Promise<boolean> {
    const exclusion = await db
      .select()
      .from(exclusions)
      .where(
        or(
          and(
            eq(exclusions.userId, user1Id),
            eq(exclusions.excludedUserId, user2Id)
          ),
          and(
            eq(exclusions.userId, user2Id),
            eq(exclusions.excludedUserId, user1Id)
          )
        )
      )
      .limit(1);
    return exclusion.length > 0;
  }
  
  async deleteExclusion(id: string): Promise<void> {
    await db.delete(exclusions).where(eq(exclusions.id, id));
  }

  // ========================================
  // SUPPORTMATCH REPORT OPERATIONS
  // ========================================

  async createReport(reportData: InsertReport): Promise<Report> {
    const [report] = await db
      .insert(reports)
      .values(reportData)
      .returning();
    return report;
  }
  
  async getAllReports(): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt));
  }
  
  async updateReportStatus(id: string, status: string, resolution?: string): Promise<Report> {
    const [report] = await db
      .update(reports)
      .set({
        status,
        resolution,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }

  // ========================================
  // SUPPORTMATCH ANNOUNCEMENT OPERATIONS
  // ========================================

  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db
      .insert(announcements)
      .values(announcementData)
      .returning();
    return announcement;
  }
  
  async getActiveAnnouncements(): Promise<Announcement[]> {
    const now = new Date();
    return await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          or(
            sql`${announcements.expiresAt} IS NULL`,
            gte(announcements.expiresAt, now)
          )
        )
      )
      .orderBy(desc(announcements.createdAt));
  }
  
  async getAllAnnouncements(): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
  }
  
  async updateAnnouncement(id: string, announcementData: Partial<InsertAnnouncement>): Promise<Announcement> {
    const [announcement] = await db
      .update(announcements)
      .set({
        ...announcementData,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();
    return announcement;
  }
  
  async deactivateAnnouncement(id: string): Promise<Announcement> {
    const [announcement] = await db
      .update(announcements)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();
    return announcement;
  }

  // ========================================
  // SUPPORTMATCH APP ANNOUNCEMENT OPERATIONS
  // ========================================

  async createSupportmatchAnnouncement(announcementData: InsertSupportmatchAnnouncement): Promise<SupportmatchAnnouncement> {
    const [announcement] = await db
      .insert(supportmatchAnnouncements)
      .values(announcementData)
      .returning();
    return announcement;
  }
  
  async getActiveSupportmatchAnnouncements(): Promise<SupportmatchAnnouncement[]> {
    const now = new Date();
    return await db
      .select()
      .from(supportmatchAnnouncements)
      .where(
        and(
          eq(supportmatchAnnouncements.isActive, true),
          or(
            sql`${supportmatchAnnouncements.expiresAt} IS NULL`,
            gte(supportmatchAnnouncements.expiresAt, now)
          )
        )
      )
      .orderBy(desc(supportmatchAnnouncements.createdAt));
  }
  
  async getAllSupportmatchAnnouncements(): Promise<SupportmatchAnnouncement[]> {
    return await db
      .select()
      .from(supportmatchAnnouncements)
      .orderBy(desc(supportmatchAnnouncements.createdAt));
  }
  
  async updateSupportmatchAnnouncement(id: string, announcementData: Partial<InsertSupportmatchAnnouncement>): Promise<SupportmatchAnnouncement> {
    const [announcement] = await db
      .update(supportmatchAnnouncements)
      .set({
        ...announcementData,
        updatedAt: new Date(),
      })
      .where(eq(supportmatchAnnouncements.id, id))
      .returning();
    return announcement;
  }
  
  async deactivateSupportmatchAnnouncement(id: string): Promise<SupportmatchAnnouncement> {
    const [announcement] = await db
      .update(supportmatchAnnouncements)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(supportmatchAnnouncements.id, id))
      .returning();
    return announcement;
  }

  // ========================================
  // SUPPORTMATCH STATS
  // ========================================

  async getSupportMatchStats() {
    const activeProfiles = await db
      .select()
      .from(supportMatchProfiles)
      .where(eq(supportMatchProfiles.isActive, true));
      
    const currentPartnerships = await db
      .select()
      .from(partnerships)
      .where(eq(partnerships.status, 'active'));
      
    const pendingReportsCount = await db
      .select()
      .from(reports)
      .where(eq(reports.status, 'pending'));
    
    return {
      activeUsers: activeProfiles.length,
      currentPartnerships: currentPartnerships.length,
      pendingReports: pendingReportsCount.length,
    };
  }

  async deleteSupportMatchProfile(userId: string, reason?: string): Promise<void> {
    const profile = await this.getSupportMatchProfile(userId);
    if (!profile) {
      throw new NotFoundError("SupportMatch profile");
    }

    const anonymizedUserId = generateAnonymizedUserId();

    // Anonymize related data
    try {
      // Anonymize partnerships where user is user1 or user2
      await db
        .update(partnerships)
        .set({ user1Id: anonymizedUserId })
        .where(eq(partnerships.user1Id, userId));
      await db
        .update(partnerships)
        .set({ user2Id: anonymizedUserId })
        .where(eq(partnerships.user2Id, userId));

      // Anonymize messages where user is sender
      await db
        .update(messages)
        .set({ senderId: anonymizedUserId })
        .where(eq(messages.senderId, userId));

      // Anonymize exclusions where user is userId or excludedUserId
      await db
        .update(exclusions)
        .set({ userId: anonymizedUserId })
        .where(eq(exclusions.userId, userId));
      await db
        .update(exclusions)
        .set({ excludedUserId: anonymizedUserId })
        .where(eq(exclusions.excludedUserId, userId));

      // Anonymize reports where user is reporter or reported
      await db
        .update(reports)
        .set({ reporterId: anonymizedUserId })
        .where(eq(reports.reporterId, userId));
      await db
        .update(reports)
        .set({ reportedUserId: anonymizedUserId })
        .where(eq(reports.reportedUserId, userId));
    } catch (error: any) {
      console.warn(`Failed to anonymize SupportMatch related data: ${error.message}`);
    }

    // Delete the profile
    await db.delete(supportMatchProfiles).where(eq(supportMatchProfiles.userId, userId));

    // Log the deletion
    await logProfileDeletion(userId, "support_match", reason);
  }
}


