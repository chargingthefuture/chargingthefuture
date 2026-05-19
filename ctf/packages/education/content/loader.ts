import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { EducationContent } from '../schema';

export function loadEducationContent(plugin: string): EducationContent {
  const filePath = path.join(__dirname, 'content', `${plugin}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  // For now, treat the whole markdown as one section
  return {
    plugin: data.plugin,
    title: data.title,
    lastUpdated: data.lastUpdated,
    sections: [
      {
        title: data.title,
        body: content,
      },
    ],
  };
}
