import { getSharedIncidentTagTrends, getSharedIncidentTrends } from './repository';
import {
  getSharedIncidentAreas,
  getSharedIncidentCategoryTrends,
  getSharedIncidentReportSummary,
  getSharedIncidentTagPairs,
} from './report-repository';
import { getSharedIncidentCountries } from './country-repository';
import type { SharedIncidentReport } from './types';

// Assembles the whole shared-incident report from its aggregate queries. One place so the trends
// endpoint and the shareable image are always built from the same set of numbers over the same
// window — a screen and an image that disagree would be worse than either alone.
export async function buildSharedIncidentReport(days = 90): Promise<SharedIncidentReport> {
  const [summary, buckets, areas, countries, tagTrends, categories, pairs] = await Promise.all([
    getSharedIncidentReportSummary(days),
    getSharedIncidentTrends(days),
    getSharedIncidentAreas(days),
    getSharedIncidentCountries(days),
    getSharedIncidentTagTrends(days),
    getSharedIncidentCategoryTrends(days),
    getSharedIncidentTagPairs(days),
  ]);
  return { summary, buckets, areas, countries, tagTrends, categories, pairs };
}
