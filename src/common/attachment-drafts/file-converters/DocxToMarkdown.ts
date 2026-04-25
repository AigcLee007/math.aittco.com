
export async function convertDocxToHTML(input: ArrayBuffer): Promise<{ html: string }> {
  try {
    // Dynamically import mammoth (lazy load to reduce initial bundle size)
    const { convertToHtml, images } = await import('mammoth');
    const result = await convertToHtml({ arrayBuffer: input }, {
      convertImage: images.imgElement(function ignoreImage(_image) {
        throw new Error('Images are not supported in DOCX to Markdown conversion');
      }),
    });
    if (result.messages?.length) {
      console.log('Messages from DOCX to Markdown conversion:', result.messages);
    }
    return {
      html: result.value,
    };
  } catch (error) {
    console.error('Error converting DOCX to Markdown:', error);
    throw error;
  }
}
