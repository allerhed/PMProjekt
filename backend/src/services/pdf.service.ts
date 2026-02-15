import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from 'pdf-lib';
import { TaskWithCounts } from '../models/task.model';
import { logger } from '../utils/logger';

export interface TaskPhoto {
  task_id: string;
  caption: string | null;
  imageBuffer: Buffer;
}

export interface BlueprintAnnotation {
  taskNumber: number;
  status: string;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  width: number; // Normalized 0-1
  height: number; // Normalized 0-1
  page: number; // 1-indexed
}

export interface BlueprintMarker {
  taskNumber: number;
  markers: Array<{ x: number; y: number; page: number }>;
}

export interface BlueprintData {
  name: string;
  pdfBuffer: Buffer;
  annotations: BlueprintAnnotation[];
  markers?: BlueprintMarker[];
}

export interface PdfGenerationData {
  organizationName: string;
  projectName: string;
  projectAddress?: string;
  projectStatus: string;
  projectStartDate?: string;
  projectTargetCompletion?: string;
  projectDescription?: string;
  responsibleUserName?: string;
  generatedAt: string;
  generatedBy: string;
  filterSummary: string;
  tasks: TaskWithCounts[];
  taskPhotos?: TaskPhoto[];
  blueprints?: BlueprintData[];
}

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_BOTTOM = 790;

// Colors matching the HTML report
const COLORS = {
  heading: '#111827',     // gray-900
  label: '#6b7280',       // gray-500
  value: '#111827',       // gray-900
  muted: '#9ca3af',       // gray-400
  border: '#d1d5db',      // gray-300
  borderDark: '#111827',  // gray-900
  statOpen: { bg: '#fef2f2', text: '#b91c1c' },       // red
  statInProgress: { bg: '#fefce8', text: '#a16207' },  // yellow
  statCompleted: { bg: '#f0fdf4', text: '#15803d' },   // green
  statVerified: { bg: '#eff6ff', text: '#1d4ed8' },    // blue
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generate a protocol PDF matching the HTML report layout.
 * Structure: Project description → Blueprints (with annotations) → Tasks table → Task photos → Footer
 *
 * Blueprints are embedded using pdf-lib to copy actual PDF pages from the blueprint files
 * and draw annotation overlays (colored rectangles + task number badges) directly on them.
 */
export async function generateProtocolPdf(data: PdfGenerationData): Promise<Buffer> {
  let projectDescPageCount = 1;

  const baseBuffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Section 1: Project Description ─────────────────────
      drawProjectDescription(doc, data);
      projectDescPageCount = doc.bufferedPageRange().count;

      // ── Section 2: Tasks Table ─────────────────────────────
      drawTasksTable(doc, data.tasks);

      // ── Section 3: Task Photos ─────────────────────────────
      if (data.taskPhotos && data.taskPhotos.length > 0) {
        drawTaskPhotos(doc, data.tasks, data.taskPhotos);
      }

      // ── Footer ─────────────────────────────────────────────
      drawFooter(doc, data.generatedAt);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  // ── Embed blueprint pages with annotations using pdf-lib ──
  if (data.blueprints && data.blueprints.length > 0) {
    return embedBlueprints(baseBuffer, data.blueprints, projectDescPageCount);
  }

  return baseBuffer;
}

function drawProjectDescription(doc: PDFKit.PDFDocument, data: PdfGenerationData): void {
  // Title
  doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.heading)
    .text('Project Protocol');
  doc.moveDown(0.3);

  // Thick divider
  const y = doc.y;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y)
    .lineWidth(2).strokeColor(COLORS.borderDark).stroke();
  doc.moveDown(0.8);

  // Project name
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.heading)
    .text(data.projectName);
  doc.moveDown(0.5);

  // Metadata grid (label: value pairs)
  const fields: [string, string][] = [];
  if (data.projectAddress) fields.push(['Address', data.projectAddress]);
  fields.push(['Status', data.projectStatus.charAt(0).toUpperCase() + data.projectStatus.slice(1)]);
  fields.push(['Start Date', formatDate(data.projectStartDate)]);
  fields.push(['Target Completion', formatDate(data.projectTargetCompletion)]);
  if (data.responsibleUserName) fields.push(['Responsible', data.responsibleUserName]);

  doc.fontSize(9).font('Helvetica');
  const labelX = MARGIN;
  const valueX = MARGIN + 120;

  for (const [label, value] of fields) {
    doc.fillColor(COLORS.label).font('Helvetica-Bold').text(label, labelX, doc.y, { continued: false });
    doc.fillColor(COLORS.value).font('Helvetica').text(value, valueX, doc.y - doc.currentLineHeight());
    doc.moveDown(0.2);
  }

  // Description
  if (data.projectDescription) {
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.label)
      .text('Description');
    doc.fontSize(9).font('Helvetica').fillColor('#374151')
      .text(data.projectDescription, { width: CONTENT_WIDTH });
  }

  // Task summary stats boxes
  doc.moveDown(1);
  drawStatBoxes(doc, data.tasks);
  doc.moveDown(1.5);
}

function drawStatBoxes(doc: PDFKit.PDFDocument, tasks: TaskWithCounts[]): void {
  const open = tasks.filter((t) => t.status === 'open').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const verified = tasks.filter((t) => t.status === 'verified').length;

  const stats = [
    { label: 'Open', value: open, colors: COLORS.statOpen },
    { label: 'In Progress', value: inProgress, colors: COLORS.statInProgress },
    { label: 'Completed', value: completed, colors: COLORS.statCompleted },
    { label: 'Verified', value: verified, colors: COLORS.statVerified },
  ];

  const boxWidth = (CONTENT_WIDTH - 30) / 4; // 10px gap x 3
  const boxHeight = 45;
  const startY = doc.y;

  stats.forEach((stat, i) => {
    const x = MARGIN + i * (boxWidth + 10);

    // Background box
    doc.save();
    doc.roundedRect(x, startY, boxWidth, boxHeight, 4)
      .fill(stat.colors.bg);
    doc.restore();

    // Value (big number)
    doc.fontSize(16).font('Helvetica-Bold').fillColor(stat.colors.text)
      .text(String(stat.value), x, startY + 8, {
        width: boxWidth,
        align: 'center',
      });

    // Label
    doc.fontSize(8).font('Helvetica').fillColor(stat.colors.text)
      .text(stat.label, x, startY + 28, {
        width: boxWidth,
        align: 'center',
      });
  });

  doc.y = startY + boxHeight;
}

function drawTasksTable(doc: PDFKit.PDFDocument, tasks: TaskWithCounts[]): void {
  // Section header
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.heading)
    .text(`Tasks (${tasks.length})`);
  doc.moveDown(0.2);

  // Divider
  const divY = doc.y;
  doc.moveTo(MARGIN, divY).lineTo(MARGIN + CONTENT_WIDTH, divY)
    .lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.moveDown(0.5);

  if (tasks.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.label)
      .text('No tasks in this project.');
    return;
  }

  // Column definitions matching HTML: #, Title, Status, Priority, Trade, Assigned To
  const colWidths = [25, 160, 65, 55, 80, 110];
  const headers = ['#', 'Title', 'Status', 'Priority', 'Trade', 'Assigned To'];
  const startX = MARGIN;

  // Table header
  let y = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
  drawTableRow(doc, headers, startX, y, colWidths);
  y += 16;

  // Header line
  doc.moveTo(startX, y - 3)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 3)
    .lineWidth(0.5).strokeColor(COLORS.border).stroke();

  // Table rows
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.heading);
  tasks.forEach((task) => {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }

    const assignee = task.assignee_first_name
      ? `${task.assignee_first_name} ${task.assignee_last_name}`
      : task.assigned_to_contractor_email || '—';

    const statusText = task.status.replace(/_/g, ' ');

    const row = [
      String(task.task_number),
      task.title.length > 32 ? task.title.substring(0, 32) + '...' : task.title,
      statusText,
      task.priority,
      (task.trade || '—').length > 15 ? (task.trade || '—').substring(0, 15) + '...' : (task.trade || '—'),
      assignee.length > 22 ? assignee.substring(0, 22) + '...' : assignee,
    ];

    doc.fillColor(COLORS.heading);
    drawTableRow(doc, row, startX, y, colWidths);

    // Light row border
    y += 15;
    doc.moveTo(startX, y - 2)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 2)
      .lineWidth(0.25).strokeColor('#f3f4f6').stroke();
  });

  doc.y = y + 10;
}

function drawTaskPhotos(
  doc: PDFKit.PDFDocument,
  tasks: TaskWithCounts[],
  taskPhotos: TaskPhoto[],
): void {
  doc.addPage();

  // Section header
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.heading)
    .text('Task Photos');
  doc.moveDown(0.2);

  const divY = doc.y;
  doc.moveTo(MARGIN, divY).lineTo(MARGIN + CONTENT_WIDTH, divY)
    .lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.moveDown(0.8);

  // Group photos by task
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const photosByTask = new Map<string, TaskPhoto[]>();
  for (const photo of taskPhotos) {
    const existing = photosByTask.get(photo.task_id) || [];
    existing.push(photo);
    photosByTask.set(photo.task_id, existing);
  }

  const photoWidth = (CONTENT_WIDTH - 20) / 3; // 3 columns with 10px gaps
  const photoHeight = 100;

  for (const [taskId, photos] of photosByTask.entries()) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    // Check if we need a new page
    if (doc.y + photoHeight + 30 > PAGE_BOTTOM) {
      doc.addPage();
    }

    // Task heading
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
      .text(`#${task.task_number}`, MARGIN, doc.y, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#374151')
      .text(` ${task.title}`);
    doc.moveDown(0.4);

    // Photo grid (3 columns)
    const startY = doc.y;
    photos.forEach((photo, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = MARGIN + col * (photoWidth + 10);
      const y = startY + row * (photoHeight + 25);

      if (y + photoHeight > PAGE_BOTTOM) {
        doc.addPage();
        return;
      }

      try {
        doc.image(photo.imageBuffer, x, y, {
          width: photoWidth,
          height: photoHeight,
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // If image fails to load, draw a placeholder
        doc.rect(x, y, photoWidth, photoHeight).strokeColor(COLORS.border).stroke();
        doc.fontSize(7).fillColor(COLORS.muted)
          .text('Image unavailable', x, y + photoHeight / 2 - 5, {
            width: photoWidth,
            align: 'center',
          });
      }

      if (photo.caption) {
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.label)
          .text(
            photo.caption.length > 30 ? photo.caption.substring(0, 30) + '...' : photo.caption,
            x, y + photoHeight + 2,
            { width: photoWidth },
          );
      }
    });

    const totalRows = Math.ceil(photos.length / 3);
    doc.y = startY + totalRows * (photoHeight + 25) + 10;
  }
}

function drawFooter(doc: PDFKit.PDFDocument, generatedAt: string): void {
  // Move to bottom area or after content
  if (doc.y > PAGE_BOTTOM - 40) {
    doc.addPage();
  }

  doc.moveDown(2);

  const footerY = doc.y;
  doc.moveTo(MARGIN, footerY).lineTo(MARGIN + CONTENT_WIDTH, footerY)
    .lineWidth(0.5).strokeColor('#e5e7eb').stroke();

  doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
    .text(
      `Generated ${formatDate(generatedAt)}`,
      MARGIN,
      footerY + 8,
      { width: CONTENT_WIDTH, align: 'center' },
    );
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  startX: number,
  y: number,
  colWidths: number[],
): void {
  let x = startX;
  cells.forEach((cell, i) => {
    doc.text(cell, x, y, { width: colWidths[i], lineBreak: false });
    x += colWidths[i];
  });
}

// ── Blueprint embedding via pdf-lib ─────────────────────────

const ANNOTATION_COLORS: Record<string, { r: number; g: number; b: number }> = {
  open: { r: 0.937, g: 0.267, b: 0.267 },        // #ef4444
  in_progress: { r: 0.918, g: 0.702, b: 0.031 },  // #eab308
  completed: { r: 0.133, g: 0.773, b: 0.369 },    // #22c55e
  verified: { r: 0.231, g: 0.510, b: 0.965 },     // #3b82f6
};

const DEFAULT_ANNOTATION_COLOR = { r: 0.420, g: 0.447, b: 0.502 }; // gray-500

/**
 * Embed blueprint PDF pages with annotation overlays into the protocol PDF.
 * Uses pdf-lib to copy pages from blueprint PDFs and insert them after the
 * project description section. Draws colored rectangles and task number
 * badges matching the HTML report's visual style.
 */
async function embedBlueprints(
  baseBuffer: Buffer,
  blueprints: BlueprintData[],
  insertAfterPage: number,
): Promise<Buffer> {
  const pdfDoc = await PDFLibDocument.load(baseBuffer);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let insertIndex = insertAfterPage;

  // Section header page
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const headerPage = pdfDoc.insertPage(insertIndex, [A4_WIDTH, A4_HEIGHT]);

  // "Blueprints" title
  headerPage.drawText('Blueprints', {
    x: MARGIN,
    y: A4_HEIGHT - MARGIN - 18,
    size: 18,
    font: helveticaBold,
    color: rgb(0.067, 0.094, 0.153),
  });

  // Divider line
  headerPage.drawLine({
    start: { x: MARGIN, y: A4_HEIGHT - MARGIN - 26 },
    end: { x: A4_WIDTH - MARGIN, y: A4_HEIGHT - MARGIN - 26 },
    thickness: 1,
    color: rgb(0.820, 0.835, 0.855),
  });

  // List blueprint names
  let labelY = A4_HEIGHT - MARGIN - 50;
  for (const bp of blueprints) {
    headerPage.drawText(bp.name, {
      x: MARGIN,
      y: labelY,
      size: 10,
      font: helveticaFont,
      color: rgb(0.231, 0.259, 0.318),
    });
    labelY -= 18;
  }

  insertIndex++;

  // Insert each blueprint's pages with annotations
  for (const blueprint of blueprints) {
    try {
      const bpDoc = await PDFLibDocument.load(blueprint.pdfBuffer);
      const bpPageCount = bpDoc.getPageCount();

      // Embed all pages from this blueprint as Form XObjects
      const pageIndices = Array.from({ length: bpPageCount }, (_, i) => i);
      const embeddedPages = await pdfDoc.embedPdf(bpDoc, pageIndices);

      for (let pageIdx = 0; pageIdx < bpPageCount; pageIdx++) {
        const embeddedPage = embeddedPages[pageIdx];
        const origWidth = embeddedPage.width;
        const origHeight = embeddedPage.height;

        // Scale to fit A4 width, maintaining aspect ratio
        const scaleFactor = A4_WIDTH / origWidth;
        const pageHeight = origHeight * scaleFactor;
        const pageWidth = A4_WIDTH;

        // Create a new blank page at the scaled dimensions
        const newPage = pdfDoc.insertPage(insertIndex, [pageWidth, pageHeight]);

        // Draw the blueprint page scaled to fit
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });

        // Small label at top of each page
        const labelText = `${blueprint.name} — Page ${pageIdx + 1}`;
        const labelBgHeight = 18;
        newPage.drawRectangle({
          x: 0,
          y: pageHeight - labelBgHeight,
          width: pageWidth,
          height: labelBgHeight,
          color: rgb(1, 1, 1),
          opacity: 0.85,
        });
        newPage.drawText(labelText, {
          x: 8,
          y: pageHeight - 13,
          size: 8,
          font: helveticaFont,
          color: rgb(0.420, 0.447, 0.502),
        });

        // Draw annotations for this page (1-indexed)
        const pageAnnotations = blueprint.annotations.filter(
          (a) => a.page === pageIdx + 1,
        );

        for (const ann of pageAnnotations) {
          const c = ANNOTATION_COLORS[ann.status] || DEFAULT_ANNOTATION_COLOR;

          // Convert normalized 0-1 coords to PDF coords (origin bottom-left)
          const rectX = ann.x * pageWidth;
          const rectWidth = ann.width * pageWidth;
          const rectHeight = ann.height * pageHeight;
          const rectY = pageHeight - (ann.y * pageHeight) - rectHeight;

          // Semi-transparent fill with solid border
          newPage.drawRectangle({
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
            borderColor: rgb(c.r, c.g, c.b),
            color: rgb(c.r, c.g, c.b),
            opacity: 0.125,
            borderOpacity: 1,
            borderWidth: 2,
          });

          // Task number badge (circle with white border + number)
          const badgeRadius = 11;
          const badgeCenterX = rectX + rectWidth / 2;
          const badgeCenterY = rectY + rectHeight / 2;

          // White border circle
          newPage.drawCircle({
            x: badgeCenterX,
            y: badgeCenterY,
            size: badgeRadius + 2,
            color: rgb(1, 1, 1),
          });

          // Colored circle
          newPage.drawCircle({
            x: badgeCenterX,
            y: badgeCenterY,
            size: badgeRadius,
            color: rgb(c.r, c.g, c.b),
          });

          // Task number text (centered)
          const numStr = String(ann.taskNumber);
          const textWidth = helveticaBold.widthOfTextAtSize(numStr, 9);
          newPage.drawText(numStr, {
            x: badgeCenterX - textWidth / 2,
            y: badgeCenterY - 3,
            size: 9,
            font: helveticaBold,
            color: rgb(1, 1, 1),
          });
        }

        // Draw markers for this page
        const MARKER_BLUE = { r: 0.231, g: 0.510, b: 0.965 };
        if (blueprint.markers) {
          for (const group of blueprint.markers) {
            const pageGroupMarkers = group.markers.filter((m) => m.page === pageIdx + 1);
            for (let mi = 0; mi < pageGroupMarkers.length; mi++) {
              const m = pageGroupMarkers[mi];
              // Convert normalized coords to PDF coords (origin bottom-left)
              const mx = m.x * pageWidth;
              const my = pageHeight - m.y * pageHeight;

              // Target dot
              newPage.drawCircle({
                x: mx,
                y: my,
                size: 4,
                color: rgb(MARKER_BLUE.r, MARKER_BLUE.g, MARKER_BLUE.b),
                borderColor: rgb(1, 1, 1),
                borderWidth: 1,
              });

              // Label circle offset
              const labelX = mx + 18;
              const labelY = my + 18;
              const markerRadius = 12;

              // Leader line
              newPage.drawLine({
                start: { x: mx, y: my },
                end: { x: labelX, y: labelY },
                thickness: 1,
                color: rgb(MARKER_BLUE.r, MARKER_BLUE.g, MARKER_BLUE.b),
                opacity: 0.7,
              });

              // White border circle
              newPage.drawCircle({
                x: labelX,
                y: labelY,
                size: markerRadius + 2,
                color: rgb(1, 1, 1),
              });

              // Blue circle
              newPage.drawCircle({
                x: labelX,
                y: labelY,
                size: markerRadius,
                color: rgb(MARKER_BLUE.r, MARKER_BLUE.g, MARKER_BLUE.b),
              });

              // Label text
              const labelStr = `${group.taskNumber}-${mi + 1}`;
              const labelTextWidth = helveticaBold.widthOfTextAtSize(labelStr, 7);
              newPage.drawText(labelStr, {
                x: labelX - labelTextWidth / 2,
                y: labelY - 2.5,
                size: 7,
                font: helveticaBold,
                color: rgb(1, 1, 1),
              });
            }
          }
        }

        insertIndex++;
      }
    } catch (err) {
      logger.warn({ err, blueprintName: blueprint.name }, 'Failed to embed blueprint in protocol PDF');
    }
  }

  const finalBytes = await pdfDoc.save();
  return Buffer.from(finalBytes);
}
