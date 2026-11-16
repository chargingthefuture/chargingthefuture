import { renderHub } from './hub-page';

export default async function HomePage() {
  return renderHub({ commons: false });
}
