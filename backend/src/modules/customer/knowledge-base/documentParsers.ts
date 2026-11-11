import zlib from 'zlib';

/**
 * Extrae texto de un archivo DOCX (contenedor PKZip con word/document.xml).
 * Implementado con buffers y zlib nativo de Node.js, sin dependencias externas.
 */
export function extractTextFromDocx(buffer: Buffer): string {
  // Buscar entradas ZIP (cabecera local: 0x04034b50)
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
      const dataOffset = offset + 30 + fileNameLen + extraLen;

      if (fileName === 'word/document.xml') {
        const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);
        let xml = '';
        if (compression === 8) {
          // Deflate raw
          xml = zlib.inflateRawSync(compressedData).toString('utf8');
        } else if (compression === 0) {
          xml = compressedData.toString('utf8');
        } else {
          throw new Error('Compresión DOCX no soportada.');
        }

        // Extraer texto de etiquetas <w:t> y saltos de párrafo <w:p>
        return xml
          .replace(/<\/w:p>/gi, '\n\n')
          .replace(/<w:tab\/>/gi, '\t')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
      }
      offset = dataOffset + compressedSize;
    } else {
      offset += 1;
    }
  }
  throw new Error('No se encontró el contenido word/document.xml en el archivo DOCX.');
}

/**
 * Extrae texto plano de un documento PDF con texto extraíble (sin OCR).
 * Descomprime streams FlateDecode y extrae secuencias entre paréntesis (text) Tj.
 */
export function extractTextFromPdf(buffer: Buffer): string {
  const content = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  const extractedPieces: string[] = [];

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let decoded = '';
    try {
      decoded = zlib.inflateSync(rawStream).toString('latin1');
    } catch {
      try {
        decoded = zlib.inflateRawSync(rawStream).toString('latin1');
      } catch {
        decoded = rawStream.toString('latin1');
      }
    }

    // Extraer cadenas en operadores de texto PDF: (texto) Tj o [(t1)(t2)] TJ
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(decoded)) !== null) {
      if (tjMatch[1]?.trim()) {
        extractedPieces.push(tjMatch[1].replace(/\\([()\\])/g, '$1'));
      }
    }

    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = arrayTjRegex.exec(decoded)) !== null) {
      const innerTj = /\(([^)]*)\)/g;
      let innerMatch: RegExpExecArray | null;
      let line = '';
      while ((innerMatch = innerTj.exec(arrMatch[1])) !== null) {
        line += innerMatch[1].replace(/\\([()\\])/g, '$1');
      }
      if (line.trim()) extractedPieces.push(line);
    }
  }

  const result = extractedPieces.join(' ').replace(/\s+/g, ' ').trim();
  if (!result || result.length < 5) {
    throw new Error('El documento PDF no contiene texto extraíble legible o está escaneado.');
  }
  return result;
}
