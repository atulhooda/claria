from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable
from datetime import datetime

def generate_pdf(report_data, filename="claria_report.pdf"):

    doc = SimpleDocTemplate(filename)
    elements = []
    styles = getSampleStyleSheet()

    # Title
    elements.append(Paragraph("<b>CLARIA MEDICAL REPORT</b>", styles["Title"]))
    elements.append(Spacer(1, 0.3 * inch))

    # Header Table (like hospital header block)
    header_data = [
        ["Patient Name:", report_data["patient_name"], "Date:", report_data["date"]],
        ["Age / Sex:", f"{report_data['age']} / {report_data['sex']}", "Doctor:", report_data["doctor_name"]],
    ]

    header_table = Table(header_data, colWidths=[1.5*inch, 2*inch, 1*inch, 2*inch])
    header_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
    ]))

    elements.append(header_table)
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(HRFlowable(width="100%", thickness=1))
    elements.append(Spacer(1, 0.3 * inch))

    # Sections
    sections = [
        ("Allergy", report_data["allergy"]),
        ("Chief Complaints", report_data["chief_complaints"]),
        ("History of Present Illness", report_data["history"]),
        ("Diagnosis Notes", report_data["diagnosis"]),
        ("Investigations Advised", report_data["investigations"]),
        ("Medicine Advised", report_data["medications"]),
        ("Advice", report_data["advice"]),
        ("Next Follow Up", report_data["follow_up"])
    ]

    for title, content in sections:
        elements.append(Paragraph(f"<b>{title}</b>", styles["Heading3"]))
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph(str(content), styles["Normal"]))
        elements.append(Spacer(1, 0.3 * inch))

    elements.append(HRFlowable(width="100%", thickness=1))
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("Dr. Claria AI", styles["Normal"]))

    doc.build(elements)