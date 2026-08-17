import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listTaxonomyJobTitles, listTaxonomySectors, listTaxonomySkills } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [sectors, jobTitles, skills] = await Promise.all([
      listTaxonomySectors(),
      listTaxonomyJobTitles(),
      listTaxonomySkills(),
    ]);

    return NextResponse.json(
      {
        sectors,
        jobTitles,
        skills,
        selectorCompatibility: {
          sectors: sectors.length,
          jobTitles: jobTitles.length,
          skills: skills.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_skills' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch skills compatibility: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
