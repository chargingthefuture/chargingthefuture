// Turns the share picture's SVG into a PNG in the page and hands it to the browser as a download.
// Nothing leaves the device: the picture is drawn here and saved here.

const SCALE = 3;

function svgImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.removeAttribute('style');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => (URL.revokeObjectURL(url), resolve(image));
    image.onerror = () => (URL.revokeObjectURL(url), reject(new Error('the picture could not be drawn')));
    image.src = url;
  });
}

export async function savePicture(svg: SVGSVGElement, width: number, height: number, fileName: string): Promise<void> {
  const image = await svgImage(svg, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('this browser has no canvas to draw on');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('the browser would not make a PNG');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
