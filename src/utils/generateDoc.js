import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType
} from 'docx'
import { saveAs } from 'file-saver'
import { format, parseISO } from 'date-fns'

function cell(text, opts = {}) {
  return new TableCell({
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    columnSpan: opts.span || 1,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text: text || '',
        bold: opts.bold || false,
        size: opts.size || 20,
        font: 'Calibri'
      })]
    })]
  })
}

function headerRow(label) {
  return new TableRow({
    children: [new TableCell({
      columnSpan: 6,
      shading: { type: ShadingType.CLEAR, fill: '1D9E75' },
      children: [new Paragraph({
        children: [new TextRun({
          text: label, bold: true, color: 'FFFFFF', size: 22, font: 'Calibri'
        })]
      })]
    })]
  })
}

function sectionTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      insideH: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      insideV: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
    },
    rows
  })
}

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 120 } })
}

function formatDate(d) {
  if (!d) return ''
  try { return format(parseISO(d), 'dd/MM/yyyy') } catch { return d }
}

function getReviewLabel(type) {
  return {
    implementation: 'Implementation Review',
    term1: 'Term 1 Review',
    term2: 'Term 2 Review',
    term3: 'Term 3 Review',
    term4: 'Term 4 Review'
  }[type] || type
}

export async function generateWordDoc(plan, student, barriers, reviews, signatures) {
  const children = []

  // Title
  children.push(new Paragraph({
    text: 'INDIVIDUAL PLAN',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }))

  children.push(new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: 'Date of Initial Plan: ', bold: true, font: 'Calibri', size: 20 }),
      new TextRun({ text: formatDate(plan.date_of_plan), font: 'Calibri', size: 20 })
    ]
  }))

  // Student details
  children.push(sectionTable([
    new TableRow({ children: [
      cell('Student Name:', { bold: true, width: 16 }),
      cell(`${student.first_name} ${student.last_name}`, { width: 18 }),
      cell('School Site:', { bold: true, width: 16 }),
      cell(student.school || '', { width: 16 }),
      cell('Class:', { bold: true, width: 12 }),
      cell(student.class || '', { width: 10 }),
    ]}),
    new TableRow({ children: [
      cell('DOB:', { bold: true }),
      cell(formatDate(student.dob), { span: 2 }),
      cell('Teacher:', { bold: true }),
      cell(plan.teacher_email || '', { span: 2 }),
    ]})
  ]))

  children.push(spacer())

  // Student profile
  children.push(sectionTable([
    headerRow('STUDENT PROFILE'),
    new TableRow({ children: [
      cell('Personal Strengths and Interests', { bold: true, shading: 'E1F5EE', span: 3 }),
      cell('Functional Presentation (Observations)', { bold: true, shading: 'E1F5EE', span: 3 }),
    ]}),
    new TableRow({ children: [
      cell(plan.strengths || '', { span: 3 }),
      cell(plan.functional_presentation || '', { span: 3 }),
    ]}),
    new TableRow({ children: [
      cell('Academic Interests', { bold: true, shading: 'E1F5EE', span: 6 }),
    ]}),
    new TableRow({ children: [
      cell(plan.academic_interests || '', { span: 6 }),
    ]}),
    new TableRow({ children: [
      cell('Collaborative Planning Team', { bold: true, shading: 'E1F5EE', span: 3 }),
      cell('External Agencies and/or Professionals', { bold: true, shading: 'E1F5EE', span: 3 }),
    ]}),
    new TableRow({ children: [
      cell(plan.planning_team || '', { span: 3 }),
      cell(plan.external_agencies
        ? `Yes\n${plan.external_agencies_details || ''}`
        : 'No', { span: 3 }),
    ]})
  ]))

  children.push(spacer())

  // Long term goal
  children.push(sectionTable([
    new TableRow({ children: [
      cell('LONG TERM GOAL (What we are working towards in the next 12 months):', { bold: true, shading: 'E1F5EE', span: 6 })
    ]}),
    new TableRow({ children: [
      cell(plan.long_term_goal || '', { span: 6 })
    ]})
  ]))

  children.push(spacer())

  // Barriers and adjustments
  for (const barrier of (barriers || [])) {
    children.push(sectionTable([
      headerRow(`BARRIER ${barrier.barrier_num}`),
      new TableRow({ children: [
        cell(barrier.description || '', { span: 6 })
      ]}),
      new TableRow({ children: [
        cell('Adjustments', { bold: true, shading: 'E1F5EE', span: 4 }),
        cell('Adjustment Start Date', { bold: true, shading: 'E1F5EE', span: 2 }),
      ]}),
      ...(barrier.adjustments || []).flatMap((adj, ai) => [
        new TableRow({ children: [
          cell(`Adjustment ${ai + 1}`, { bold: true, shading: 'F5F5F0', span: 4 }),
          cell(formatDate(adj.start_date), { span: 2 }),
        ]}),
        new TableRow({ children: [
          cell(adj.description || '', { span: 6 }),
        ]}),
        new TableRow({ children: [
          cell('Intensity', { bold: true, shading: 'F5F5F0', span: 2 }),
          cell('Frequency', { bold: true, shading: 'F5F5F0', span: 2 }),
          cell('Person/s responsible', { bold: true, shading: 'F5F5F0', span: 2 }),
        ]}),
        new TableRow({ children: [
          cell(adj.intensity || '', { span: 2 }),
          cell(adj.frequency || '', { span: 2 }),
          cell(adj.person_responsible || '', { span: 2 }),
        ]}),
        new TableRow({ children: [
          cell('Monitoring method', { bold: true, shading: 'F5F5F0', span: 3 }),
          cell('Monitoring frequency', { bold: true, shading: 'F5F5F0', span: 3 }),
        ]}),
        new TableRow({ children: [
          cell(adj.monitoring_method || '', { span: 3 }),
          cell(adj.monitoring_frequency || '', { span: 3 }),
        ]}),
      ])
    ]))
    children.push(spacer())
  }

  // Reviews
  children.push(sectionTable([
    headerRow('REVIEW'),
    new TableRow({ children: [
      cell('Review', { bold: true, shading: 'E1F5EE', span: 2 }),
      cell('Notes', { bold: true, shading: 'E1F5EE', span: 2 }),
      cell('Attendees', { bold: true, shading: 'E1F5EE' }),
      cell('Next Review Date', { bold: true, shading: 'E1F5EE' }),
    ]}),
    ...(reviews || []).map(r => new TableRow({ children: [
      cell(getReviewLabel(r.review_type), { bold: true, span: 2 }),
      cell([r.notes, r.follow_up_actions ? `\nFollow-up: ${r.follow_up_actions}` : ''].join(''), { span: 2 }),
      cell([
        r.attendee_teacher ? `Teacher: ${r.attendee_teacher}` : '',
        r.attendee_parent ? `Parent: ${r.attendee_parent}` : '',
        r.attendee_student ? `Student: ${r.attendee_student}` : ''
      ].filter(Boolean).join('\n')),
      cell(formatDate(r.next_review_date)),
    ]}))
  ]))

  children.push(spacer())

  // Signature log
  children.push(sectionTable([
    headerRow('SIGNATURE LOG & REVIEW CHECKLIST'),
    new TableRow({ children: [
      cell('Date', { bold: true, shading: 'E1F5EE' }),
      cell('Checklist', { bold: true, shading: 'E1F5EE', span: 2 }),
      cell('Name and Signature of Attendees', { bold: true, shading: 'E1F5EE', span: 3 }),
    ]}),
    ...(signatures || []).map(sig => new TableRow({ children: [
      cell(formatDate(sig.signed_at)),
      cell(`Reviewed: Student Profile, Functional Presentation, Long Term Goal, Adjustments`, { span: 2 }),
      cell(`${sig.signed_by}: ${sig.signer_name}`, { span: 3 }),
    ]}))
  ]))

  children.push(spacer())

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: 'Indie School | Individual Plan | Version Date: January 2026 | Review Date: December 2026',
      size: 16, color: '888888', font: 'Calibri'
    })]
  }))

  const doc = new Document({
    sections: [{ properties: {}, children }]
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `IP_${student.last_name}_${student.first_name}_v${plan.version}.docx`)
}
