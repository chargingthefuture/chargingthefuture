import { renderHub } from '../hub-page';

// The 3.0 Commons at its own address, with its public view for a signed-out visitor.
export default async function CommonsPage() {
  return renderHub({ commons: true });
}
