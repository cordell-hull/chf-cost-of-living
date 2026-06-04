import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { ORG_CONFIG } from '../config/org.js';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function _fmt(num) {
  if (!num) return '0';
  const hasDecimals = num % 1 !== 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
}

export class PDFGenerator {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = null;
    this.currentY = 0;
    this.font = null;
    this.fontBold = null;
    this.margins = ORG_CONFIG.pdf.margins;
    this.colors = ORG_CONFIG.pdf.colors;
    this.fonts = ORG_CONFIG.pdf.fonts;
    this.contentWidth = PAGE_WIDTH - this.margins.left - this.margins.right;
  }

  async init() {
    this.pdfDoc = await PDFDocument.create();
    this.pdfDoc.setTitle('Cost of Living Estimate');
    this.pdfDoc.setAuthor(ORG_CONFIG.pdf.author);
    this.pdfDoc.setCreationDate(new Date());

    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    this.addNewPage();
  }

  addNewPage() {
    this.currentPage = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.currentY = PAGE_HEIGHT - this.margins.top;
    return this.currentPage;
  }

  addPageIfNeeded(neededHeight) {
    if (this.currentY - neededHeight < this.margins.bottom) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  addSpace(space) {
    this.currentY -= space;
  }

  drawLine() {
    this.addPageIfNeeded(15);
    this.currentY -= 5;
    this.currentPage.drawLine({
      start: { x: this.margins.left, y: this.currentY },
      end: { x: PAGE_WIDTH - this.margins.right, y: this.currentY },
      thickness: 0.5,
      color: rgb(this.colors.lightGray.r, this.colors.lightGray.g, this.colors.lightGray.b)
    });
    this.currentY -= 10;
  }

  async drawOrgHeader() {
    let logoBytes = null;
    try {
      const logoResponse = await fetch(ORG_CONFIG.logoPath);
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        logoBytes = new Uint8Array(await logoBlob.arrayBuffer());
      }
    } catch (e) {
      console.warn('Could not load logo:', e);
    }

    if (logoBytes) {
      try {
        let logoImage;
        try { logoImage = await this.pdfDoc.embedPng(logoBytes); }
        catch { logoImage = await this.pdfDoc.embedJpg(logoBytes); }

        const logoMaxHeight = 60;
        const logoMaxWidth = 150;
        const logoAspect = logoImage.width / logoImage.height;
        let logoWidth = logoMaxWidth;
        let logoHeight = logoWidth / logoAspect;
        if (logoHeight > logoMaxHeight) {
          logoHeight = logoMaxHeight;
          logoWidth = logoHeight * logoAspect;
        }

        this.currentPage.drawImage(logoImage, {
          x: this.margins.left,
          y: this.currentY - logoHeight,
          width: logoWidth,
          height: logoHeight
        });
      } catch (e) {
        console.warn('Could not embed logo:', e);
      }
    }

    const rightX = PAGE_WIDTH - this.margins.right;
    let textY = this.currentY - 12;

    const nameWidth = this.fontBold.widthOfTextAtSize(ORG_CONFIG.name, 11);
    this.currentPage.drawText(ORG_CONFIG.name, {
      x: rightX - nameWidth, y: textY, size: 11, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    textY -= 14;

    for (const line of ORG_CONFIG.address) {
      const lineWidth = this.font.widthOfTextAtSize(line, 9);
      this.currentPage.drawText(line, {
        x: rightX - lineWidth, y: textY, size: 9, font: this.font,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      textY -= 12;
    }

    const webWidth = this.font.widthOfTextAtSize(ORG_CONFIG.website, 9);
    this.currentPage.drawText(ORG_CONFIG.website, {
      x: rightX - webWidth, y: textY, size: 9, font: this.font,
      color: rgb(this.colors.accent.r, this.colors.accent.g, this.colors.accent.b)
    });

    this.currentY -= 80;
    this.drawLine();
  }

  drawTitle(title, subtitle) {
    this.addSpace(10);

    const titleWidth = this.fontBold.widthOfTextAtSize(title, this.fonts.title);
    this.currentPage.drawText(title, {
      x: (PAGE_WIDTH - titleWidth) / 2,
      y: this.currentY - this.fonts.title,
      size: this.fonts.title, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= this.fonts.title + 10;

    if (subtitle) {
      const subWidth = this.fontBold.widthOfTextAtSize(subtitle, this.fonts.subheading);
      this.currentPage.drawText(subtitle, {
        x: (PAGE_WIDTH - subWidth) / 2,
        y: this.currentY - this.fonts.subheading,
        size: this.fonts.subheading, font: this.fontBold,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      this.currentY -= this.fonts.subheading + 15;
    }
  }

  drawSectionHeading(text) {
    this.addPageIfNeeded(40);
    this.currentY -= 15;

    this.currentPage.drawText(text, {
      x: this.margins.left,
      y: this.currentY - this.fonts.heading,
      size: this.fonts.heading, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= this.fonts.heading + 5;

    this.currentPage.drawLine({
      start: { x: this.margins.left, y: this.currentY },
      end: { x: PAGE_WIDTH - this.margins.right, y: this.currentY },
      thickness: 1,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= 10;
  }

  drawCostRow(label, value, options = {}) {
    const { bold = false, fontSize = this.fonts.body } = options;
    const lineHeight = fontSize * 1.6;

    this.addPageIfNeeded(lineHeight);

    const font = bold ? this.fontBold : this.font;
    const sanitizedLabel = (label || '').replace(/[\r\n]+/g, ' ').trim();
    const sanitizedValue = (value || '').replace(/[\r\n]+/g, ' ').trim();

    this.currentPage.drawText(sanitizedLabel, {
      x: this.margins.left + 5,
      y: this.currentY - fontSize,
      size: fontSize, font,
      color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
    });

    const valueWidth = font.widthOfTextAtSize(sanitizedValue, fontSize);
    this.currentPage.drawText(sanitizedValue, {
      x: PAGE_WIDTH - this.margins.right - valueWidth - 5,
      y: this.currentY - fontSize,
      size: fontSize, font,
      color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
    });

    this.currentY -= lineHeight;
  }

  drawWrappedText(text, x, maxWidth, options = {}) {
    const { fontSize = this.fonts.body, font = this.font, color = this.colors.text, lineHeight = 1.3 } = options;

    const sanitized = (text || '').replace(/[\r\n\t]+/g, ' ').trim();
    if (sanitized === '') return 0;

    const words = sanitized.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const actualLineHeight = fontSize * lineHeight;

    for (const line of lines) {
      if (this.currentY - actualLineHeight < this.margins.bottom) this.addNewPage();

      this.currentPage.drawText(line, {
        x, y: this.currentY - fontSize, size: fontSize, font,
        color: rgb(color.r, color.g, color.b)
      });
      this.currentY -= actualLineHeight;
    }

    return lines.length * actualLineHeight;
  }

  async generate(report, onProgress = () => {}) {
    onProgress('Initializing PDF...');
    await this.init();
    await this.drawOrgHeader();

    const location = `${report.school.city}, ${report.school.state}`;
    this.drawTitle('Cost of Living Estimate', report.school.name);
    this.drawCostRow('Location', location, { bold: true });

    // School Contact
    onProgress('Adding school information...');
    this.drawSectionHeading('School Contact');
    this.drawCostRow('School', report.school.name);
    if (report.school.address) this.drawCostRow('Address', report.school.address);
    if (report.school.contactName) this.drawCostRow('Contact', report.school.contactName);
    if (report.school.email) this.drawCostRow('Email', report.school.email);
    if (report.school.phone) this.drawCostRow('Phone', report.school.phone);

    // Health Insurance
    onProgress('Adding health insurance...');
    this.drawSectionHeading('Health Insurance');
    const insOffered = report.healthInsurance.schoolOffers;
    this.drawCostRow('School offers health insurance', insOffered === true ? 'Yes' : insOffered === false ? 'No' : '--');
    if (insOffered) {
      if (report.healthInsurance.schoolCoversFullCost) {
        this.drawCostRow('Cost to teacher', 'School covers the full cost');
      } else if (report.healthInsurance.monthlyCostToTeacher) {
        this.drawCostRow('Monthly cost to teacher', `$${_fmt(report.healthInsurance.monthlyCostToTeacher)}`);
      }
    }
    if (report.healthInsurance.monthlyPremiumEstimate) {
      this.drawCostRow('Monthly premium estimate', `$${_fmt(report.healthInsurance.monthlyPremiumEstimate)}`);
    }
    if (report.healthInsurance.j2Offered) {
      this.drawCostRow('J-2 Dependent monthly premium', report.healthInsurance.j2DependentCost ? `$${_fmt(report.healthInsurance.j2DependentCost)}` : '--');
    } else {
      this.drawCostRow('J-2 Dependent coverage', 'Not offered');
    }

    this.addSpace(8);
    this.drawWrappedText(
      'Note: The type of coverage required by J-1 regulations is satisfied by the Cordell Hull Foundation group plan offered by Envisage Global Insurance which is approximately $50 per month per teacher or J-2 dependent. You can charge to a credit card and must obtain this insurance in advance before arriving in the U.S., if not immediately covered by the school plan.',
      this.margins.left + 5, this.contentWidth - 10,
      { fontSize: 11, color: this.colors.secondary }
    );
    this.addSpace(3);
    this.drawWrappedText(
      'Link: https://www.envisageglobalinsurance.com/student-zone/Cordell-hull  |  Code: CHF',
      this.margins.left + 5, this.contentWidth - 10,
      { fontSize: 11, color: this.colors.accent }
    );
    this.addSpace(3);
    this.drawWrappedText(
      'CHF covers you and your family dependents ONLY for repatriation and medical evacuation. You are responsible to inscribe in and pay the required health insurance. Even if the school arranges it as part of your compensation, it is your responsibility to make sure that you and all family members are insured from the point of arrival until June 30 the following year and every year thereafter.',
      this.margins.left + 5, this.contentWidth - 10,
      { fontSize: 11, color: this.colors.secondary }
    );

    // Food
    onProgress('Adding food costs...');
    this.drawSectionHeading('Food Costs');
    this.drawCostRow('Estimated cost per teacher per week', `$${_fmt(report.food.weeklyEstimate)}`, { bold: true });
    this.addSpace(5);

    for (const item of report.food.items) {
      if (item.amount > 0) {
        this.drawCostRow(item.label, `$${_fmt(item.amount)}`);
      }
    }

    // Taxes & Fees
    onProgress('Adding tax information...');
    this.drawSectionHeading('Tax Deductions & Fees');
    if (report.taxes.federalPercent) {
      this.drawCostRow('Federal tax (% of gross salary)', `${report.taxes.federalPercent}%`);
    }
    if (report.taxes.noStateTax) {
      this.drawCostRow('State income tax', `No state tax in ${report.school.state}`);
    } else if (report.taxes.statePercent) {
      this.drawCostRow('State tax (% of gross salary)', `${report.taxes.statePercent}%`);
    }

    this.addSpace(5);
    this.drawWrappedText(
      'Social Security and Medicare: All J-1 visaholders are exempt for the first year and a half.',
      this.margins.left + 5, this.contentWidth - 10,
      { fontSize: this.fonts.small, font: this.fontBold, color: this.colors.secondary }
    );
    this.addSpace(5);

    if (report.taxes.educationEvalNotNeeded) {
      this.drawCostRow('Education Evaluation', 'Not needed');
    } else if (report.taxes.educationEvaluation) {
      this.drawCostRow('Education Evaluation', `$${_fmt(report.taxes.educationEvaluation)}`);
    }

    if (report.taxes.noUnionFees) {
      this.drawCostRow('Union Fees', 'No union fees');
    } else if (report.taxes.unionFees) {
      this.drawCostRow('Union Fees', `$${_fmt(report.taxes.unionFees)}/mo`);
    }

    // Visa Fees
    onProgress('Adding visa fees...');
    this.drawSectionHeading('Visa & Sponsorship Fees');

    this.drawWrappedText(
      'The school is required to pay the Cordell Hull Foundation sponsorship fees of $1,500 for the first year, $800 for the second and third year. The teacher must not pay these fees.',
      this.margins.left + 5, this.contentWidth - 10,
      { fontSize: this.fonts.body, font: this.fontBold, color: this.colors.text }
    );
    this.addSpace(8);

    const _feeVal = (v) => v === 'school' ? 'Reimbursed by school' : 'Teacher is responsible';
    if (report.visaFees.embassyVisa) this.drawCostRow('Embassy Visa fee ($185)', _feeVal(report.visaFees.embassyVisa));
    if (report.visaFees.sevis) this.drawCostRow('SEVIS database fee ($220)', _feeVal(report.visaFees.sevis));
    if (report.visaFees.integrityFee) {
      const intNote = report.visaFees.integrityFee === 'teacher'
        ? 'Teacher responsible (US govt. promises future reimbursement)'
        : 'Reimbursed by school';
      this.drawCostRow('VISA Integrity fee ($500)', intNote);
    }
    if (report.visaFees.courierFee) this.drawCostRow('Embassy courier fee (~$30)', _feeVal(report.visaFees.courierFee));

    // Housing
    onProgress('Adding housing costs...');
    this.drawSectionHeading('Housing');

    if (report.housing.hostFamily === true) {
      this.drawCostRow('Host family', 'Yes - possible to arrange, contact the school');
    } else if (report.housing.hostFamily === false) {
      this.drawCostRow('Host family', 'No - school does not provide');
    }

    const apartments = [
      ['Studio apartment (inexpensive area)', report.housing.studioInexpensive],
      ['Studio apartment (near school)', report.housing.studioNearSchool],
      ['1-Bedroom (inexpensive area)', report.housing.oneBedInexpensive],
      ['1-Bedroom (near school)', report.housing.oneBedNearSchool],
      ['2-Bedroom (inexpensive area)', report.housing.twoBedInexpensive],
      ['2-Bedroom (near school)', report.housing.twoBedNearSchool]
    ];
    for (const [label, amount] of apartments) {
      if (amount) this.drawCostRow(label, `$${_fmt(amount)}/mo`);
    }

    this.addSpace(5);
    const utilities = [
      ['Cellphone', report.housing.cellphone],
      ['Internet', report.housing.internet],
      ['Electricity', report.housing.electricity]
    ];
    for (const [label, amount] of utilities) {
      if (amount) this.drawCostRow(label, `$${_fmt(amount)}/mo`);
    }

    // Transportation
    onProgress('Adding transportation...');
    this.drawSectionHeading('Transportation');

    if (report.transportation.singleRide) {
      this.drawCostRow('Public Transport (single ride)', `$${_fmt(report.transportation.singleRide)}`);
    }
    if (report.transportation.monthlyPass) {
      this.drawCostRow('Public Transport (monthly pass)', `$${_fmt(report.transportation.monthlyPass)}/mo`);
    }
    if (report.transportation.leaseCost) {
      this.drawCostRow('Car Lease', `$${_fmt(report.transportation.leaseCost)}`);
    }
    if (report.transportation.usedCarCost) {
      this.drawCostRow('Used Car', `$${_fmt(report.transportation.usedCarCost)}`);
    }
    if (report.transportation.newCarDeal) {
      this.drawCostRow('Special New Car Deal', '');
      this.drawWrappedText(report.transportation.newCarDeal, this.margins.left + 15, this.contentWidth - 15);
    }
    if (report.transportation.gasPerWeek) {
      this.drawCostRow('Gas per week', `$${_fmt(report.transportation.gasPerWeek)}/wk`);
    }

    // Entertainment
    onProgress('Adding entertainment...');
    this.drawSectionHeading('Entertainment');

    if (report.entertainment.movieTicket) {
      this.drawCostRow('Movie ticket', `$${_fmt(report.entertainment.movieTicket)}`);
    }

    const sports = [
      ['Broadway Show', report.entertainment.broadway, report.entertainment.broadwayStatus],
      ['Professional Baseball', report.entertainment.baseball, report.entertainment.baseballStatus],
      ['Professional Basketball', report.entertainment.basketball, report.entertainment.basketballStatus],
      ['Professional Hockey', report.entertainment.hockey, report.entertainment.hockeyStatus]
    ];

    for (const [name, cost, status] of sports) {
      if (status === 'na') {
        this.drawCostRow(name, 'Not available in our area');
      } else if (status === 'local') {
        this.drawCostRow(name, cost ? `Local games only - $${_fmt(cost)}` : 'Local games only');
      } else if (cost) {
        this.drawCostRow(name, `$${_fmt(cost)}`);
      }
    }

    // Embed report data for re-import
    onProgress('Finalizing PDF...');
    this.pdfDoc.setSubject(JSON.stringify(report));

    return await this.pdfDoc.save();
  }
}

export async function generatePDF(report, onProgress = () => {}) {
  const generator = new PDFGenerator();
  return await generator.generate(report, onProgress);
}

export function generateFilename(city, schoolName) {
  const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
  return `Cost_of_Living_${sanitize(city)}_${sanitize(schoolName)}.pdf`;
}

export async function importReportFromPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer);
  const subject = pdfDoc.getSubject();
  if (!subject) return null;
  try {
    const data = JSON.parse(subject);
    if (!data.school || !data.school.name) return null;
    return data;
  } catch { return null; }
}

export function downloadPDF(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
