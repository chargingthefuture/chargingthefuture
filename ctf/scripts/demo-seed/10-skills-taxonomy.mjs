// Skills Taxonomy demo data: the twenty sectors the live taxonomy carries, by their live names, each
// with one to four job titles and their skills, so the browser shows a real tree (TAX-1, TAX-2) and
// Retail & Services › Supply Managers holds Merchandising beside its other skills (TAX-5).
//
// Workforce's Community Planning teams match sectors by these exact names, so every team resolves
// and none shows "not mapped" (WF-10). The base seed's Technology › Platform Engineer rows are left
// as they are and stay first (display_order 1); these sectors start at 2.
//
// "Crisis intervention" sits under three Health job titles on purpose: the Directory skills picker
// shows a skill held under several occupations as one chip with a "counts in" caption (DIR-4 2b).
//
// Ids are fixed in this module's range, ddd00000-0000-4000-8100-0000000000XX: sectors 01-14,
// job titles 20-3f, skills 40 and up. Never renumber one; Workforce and Directory modules point at them.

const id = (n) => `ddd00000-0000-4000-8100-${n.toString(16).padStart(12, '0')}`;

// [sector id, name, workforce share, [[job title id, name, [[skill id, name], ...]], ...]]
const TREE = [
  [0x01, 'Food & Agriculture', 0.06, [
    [0x20, 'Farmworkers', [[0x40, 'Crop planting'], [0x41, 'Harvesting'], [0x42, 'Irrigation']]],
    [0x21, 'Food Processing Workers', [[0x43, 'Canning and preserving'], [0x44, 'Food safety handling']]],
  ]],
  [0x02, 'Tourism & Hospitality', 0.05, [
    [0x22, 'Chefs and Cooks', [[0x45, 'Cooking for large groups'], [0x46, 'Meal planning'], [0x47, 'Kitchen sanitation']]],
    [0x23, 'Housekeepers', [[0x48, 'Laundry care'], [0x49, 'Room cleaning']]],
  ]],
  [0x03, 'Health', 0.08, [
    [0x24, 'Home Health Aides', [[0x4a, 'Personal care assistance'], [0x4b, 'Crisis intervention'], [0x4c, 'Medication reminders']]],
    [0x25, 'Medical Assistants', [[0x4d, 'Taking vital signs'], [0x4e, 'Patient intake'], [0x4f, 'Crisis intervention']]],
    [0x26, 'Lab Technicians', [[0x50, 'Laboratory testing (basic)'], [0x51, 'Specimen handling']]],
    [0x27, 'Peer Support Specialists', [[0x52, 'Active listening'], [0x53, 'Crisis intervention']]],
  ]],
  [0x04, 'Housing & Construction', 0.07, [
    [0x28, 'Carpenters', [[0x54, 'Framing'], [0x55, 'Finish carpentry'], [0x56, 'Reading blueprints']]],
    [0x29, 'Electricians', [[0x57, 'Residential wiring'], [0x58, 'Reading blueprints']]],
    [0x2a, 'Plumbers', [[0x59, 'Pipe fitting'], [0x5a, 'Fixture installation']]],
  ]],
  [0x05, 'Energy & Utilities', 0.03, [
    [0x2b, 'Solar Panel Installers', [[0x5b, 'Solar panel installation'], [0x5c, 'Battery storage setup']]],
  ]],
  [0x06, 'Water & Sanitation', 0.02, [
    [0x2c, 'Water Treatment Plant Operators', [[0x5d, 'Water quality testing'], [0x5e, 'Pump maintenance']]],
  ]],
  [0x07, 'Telecommunications & IT', 0.04, [
    [0x2d, 'Computer Support Specialists', [[0x5f, 'Help desk support'], [0x60, 'Network cabling'], [0x61, 'Device setup']]],
  ]],
  [0x08, 'R&D & High-Tech', 0.02, [
    [0x2e, 'Research Assistants', [[0x62, 'Data collection'], [0x63, 'Literature review']]],
  ]],
  [0x09, 'Transport & Logistics', 0.05, [
    [0x2f, 'Truck Drivers', [[0x64, 'Commercial driving (CDL)'], [0x65, 'Route planning'], [0x66, 'Vehicle inspection']]],
    [0x30, 'Warehouse Workers', [[0x67, 'Forklift operation'], [0x68, 'Inventory control'], [0x69, 'Order picking']]],
  ]],
  [0x0a, 'Retail & Services', 0.06, [
    [0x31, 'Supply Managers', [[0x6a, 'Inventory control'], [0x6b, 'Supplier negotiation'], [0x6c, 'Demand forecasting'], [0x6d, 'Merchandising']]],
    [0x32, 'Cashiers', [[0x6e, 'Cash handling'], [0x6f, 'Customer service']]],
  ]],
  [0x0b, 'Professional & Business Services', 0.05, [
    [0x33, 'Administrative Assistants', [[0x70, 'Scheduling'], [0x71, 'Data entry'], [0x72, 'Office software']]],
  ]],
  [0x0c, 'Finance & Public Administration', 0.03, [
    [0x34, 'Bookkeepers', [[0x73, 'Bookkeeping'], [0x74, 'Accounts payable']]],
  ]],
  [0x0d, 'Microfinance & SME Support', 0.01, [
    [0x35, 'Small Business Advisors', [[0x75, 'Business planning'], [0x76, 'Grant writing']]],
  ]],
  [0x0e, 'Public Safety & Justice', 0.03, [
    [0x36, 'Paralegals', [[0x77, 'Legal research'], [0x78, 'Document preparation']]],
  ]],
  [0x0f, 'Emergency & Reserve Roles', 0.01, [
    [0x37, 'Emergency Responders', [[0x79, 'First aid and CPR'], [0x7a, 'Emergency planning']]],
  ]],
  [0x10, 'Creative & Media', 0.03, [
    [0x38, 'Writers and Editors', [[0x7b, 'Editing'], [0x7c, 'Plain-language writing']]],
    [0x39, 'Photographers', [[0x7d, 'Photography'], [0x7e, 'Photo editing']]],
  ]],
  [0x11, 'Education', 0.05, [
    [0x3a, 'Teaching Assistants', [[0x7f, 'Tutoring'], [0x80, 'Classroom support']]],
    [0x3b, 'Childcare Workers', [[0x81, 'Childcare'], [0x82, 'Early learning activities']]],
  ]],
  [0x12, 'Environmental & Waste Management', 0.02, [
    [0x3c, 'Recycling Coordinators', [[0x83, 'Waste sorting'], [0x84, 'Composting']]],
  ]],
  [0x13, 'Manufacturing & Industry', 0.04, [
    [0x3d, 'Welders', [[0x85, 'MIG welding'], [0x86, 'Metal fabrication']]],
    [0x3e, 'Machinists', [[0x87, 'Lathe operation'], [0x88, 'Precision measuring']]],
  ]],
  [0x14, 'Mining / Extractive', 0.01, [
    [0x3f, 'Quarry Workers', [[0x89, 'Heavy equipment operation'], [0x8a, 'Blasting safety']]],
  ]],
];

// Exported so the Workforce and Directory modules name a skill or job title by text, not by number.
export const TAXONOMY_IDS = (() => {
  const sectors = {};
  const jobTitles = {};
  const skills = {};
  for (const [sectorNum, sectorName, , titles] of TREE) {
    sectors[sectorName] = id(sectorNum);
    for (const [titleNum, titleName, skillList] of titles) {
      jobTitles[titleName] = { id: id(titleNum), sectorId: id(sectorNum) };
      for (const [skillNum, skillName] of skillList) {
        skills[`${titleName} › ${skillName}`] = id(skillNum);
      }
    }
  }
  return { sectors, jobTitles, skills };
})();

export default async function seed(client) {
  for (const [sectorIndex, [sectorNum, sectorName, share, titles]] of TREE.entries()) {
    await client.query(
      `INSERT INTO skills_taxonomy_sectors (id, name, display_order, workforce_share, is_active)
       VALUES ($1::uuid, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, display_order = EXCLUDED.display_order,
         workforce_share = EXCLUDED.workforce_share, is_active = true, updated_at = NOW()`,
      [id(sectorNum), sectorName, sectorIndex + 2, share],
    );
    for (const [titleIndex, [titleNum, titleName, skillList]] of titles.entries()) {
      await client.query(
        `INSERT INTO skills_taxonomy_job_titles (id, sector_id, name, display_order, is_active)
         VALUES ($1::uuid, $2::uuid, $3, $4, true)
         ON CONFLICT (id) DO UPDATE SET
           sector_id = EXCLUDED.sector_id, name = EXCLUDED.name,
           display_order = EXCLUDED.display_order, is_active = true, updated_at = NOW()`,
        [id(titleNum), id(sectorNum), titleName, titleIndex + 1],
      );
      for (const [skillIndex, [skillNum, skillName]] of skillList.entries()) {
        await client.query(
          `INSERT INTO skills_taxonomy_skills (id, job_title_id, name, display_order, aliases, is_active)
           VALUES ($1::uuid, $2::uuid, $3, $4, '[]'::jsonb, true)
           ON CONFLICT (id) DO UPDATE SET
             job_title_id = EXCLUDED.job_title_id, name = EXCLUDED.name,
             display_order = EXCLUDED.display_order, is_active = true, updated_at = NOW()`,
          [id(skillNum), id(titleNum), skillName, skillIndex + 1],
        );
      }
    }
  }
  console.log('  ✓ demo-seed: skills-taxonomy (20 sectors, 32 job titles, 75 skills)');
}
