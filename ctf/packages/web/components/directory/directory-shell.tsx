"use client";


import { useEffect, useState } from "react";

// Directory API types
export interface Profile {
  id: string;
  name: string;
  email: string;
  sector: string;
  jobTitle: string;
  skills: string[];
  // Add more fields as needed
}

export interface Member {
  id: string;
  name: string;
  sector: string;
  jobTitle: string;
  skills: string[];
  // Add more fields as needed
}

export interface Sector {
  id: string;
  name: string;
}

export interface JobTitle {
  id: string;
  name: string;
}

export interface Skill {
  id: string;
  name: string;
}

export function DirectoryShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filters, setFilters] = useState({ sector: '', skill: '', query: '' });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, sectorsRes, jobTitlesRes, skillsRes] = await Promise.all([
          fetch('/api/directory/profile'),
          fetch('/api/directory/sectors'),
          fetch('/api/directory/job-titles'),
          fetch('/api/directory/skills'),
        ]);
        if (!profileRes.ok) throw new Error('Failed to load profile');
        if (!sectorsRes.ok) throw new Error('Failed to load sectors');
        if (!jobTitlesRes.ok) throw new Error('Failed to load job titles');
        if (!skillsRes.ok) throw new Error('Failed to load skills');
        setProfile(await profileRes.json() as Profile);
        setSectors(await sectorsRes.json() as Sector[]);
        setJobTitles(await jobTitlesRes.json() as JobTitle[]);
        setSkills(await skillsRes.json() as Skill[]);
      } catch (e: any) {
        setError(e.message || 'Failed to load directory data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchMembers() {
      setLoadingMembers(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.sector) params.append('sector', filters.sector);
        if (filters.skill) params.append('skill', filters.skill);
        if (filters.query) params.append('query', filters.query);
        params.append('page', String(page));
        const res = await fetch(`/api/directory/list?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load members');
        const data = await res.json();
        if (!controller.signal.aborted) {
          setMembers((data.members || []) as Member[]);
          setHasMore(Boolean(data.hasMore));
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (!controller.signal.aborted) setError(e.message || 'Failed to load members.');
      } finally {
        if (!controller.signal.aborted) setLoadingMembers(false);
      }
    }
    fetchMembers();
    return () => controller.abort();
  }, [filters, page]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading directory…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Directory</h2>
        <p className="mb-4">Create your directory profile to connect with the community.</p>
      </div>
    );
  }
  if (!members.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Directory</h2>
        <p className="mb-4">No members found matching your criteria.</p>
      </div>
    );
  }

  // ...existing UI code, now using members, profile, sectors, jobTitles, skills, filters, page, hasMore...
  return (
    <div>
      {/* Directory UI goes here, using fetched data and handlers */}
    </div>
  );
}
