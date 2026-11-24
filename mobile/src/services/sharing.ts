/**
 * Native Sharing & WhatsApp Integration Service
 */
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { Prescription, Invoice } from '../types';

export const ShareService = {
  /**
   * Share Prescription text/details directly to WhatsApp
   */
  async sharePrescriptionViaWhatsApp(phone: string, prescription: Prescription): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    const medicinesList = prescription.medicines
      .map((m, idx) => `${idx + 1}. *${m.name}* (${m.dosage}) - ${m.frequency} for ${m.duration} [${m.timing.replace('_', ' ')}]`)
      .join('\n');

    const message = `*Prescription from ${prescription.clinicName}*\n` +
      `*Doctor:* Dr. ${prescription.doctorName}\n` +
      `*Patient:* ${prescription.patientName}\n` +
      `*Date:* ${prescription.date}\n\n` +
      `*Diagnosis:* ${prescription.diagnosis.join(', ') || 'General Consultation'}\n\n` +
      `*Medicines:*\n${medicinesList}\n\n` +
      `*Advice:* ${prescription.advice || 'Follow medication schedule carefully.'}\n\n` +
      `*Follow-up:* ${prescription.followUpDate || 'As needed'}\n\n` +
      `_Generated via ClinicX Health Platform_`;

    const encodedMessage = encodeURIComponent(message);
    const url = Platform.OS === 'web'
      ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      : `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        // Fallback to web link
        await Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodedMessage}`);
        return true;
      }
    } catch {
      return false;
    }
  },

  /**
   * Share Invoice / Payment Link to Patient via WhatsApp
   */
  async shareInvoiceViaWhatsApp(phone: string, invoice: Invoice, upiId?: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    const itemsList = invoice.items
      .map(item => `- ${item.description}: ₹${item.amount} (x${item.quantity})`)
      .join('\n');

    let upiString = '';
    if (upiId) {
      upiString = `\n*Pay via UPI:* upi://pay?pa=${upiId}&pn=ClinicX&am=${invoice.totalAmount}&cu=INR\n`;
    }

    const message = `*Invoice #${invoice.invoiceNumber}*\n` +
      `*Patient:* ${invoice.patientName}\n` +
      `*Date:* ${invoice.date}\n\n` +
      `*Items:*\n${itemsList}\n\n` +
      `*Total Amount:* ₹${invoice.totalAmount}\n` +
      `*Payment Status:* ${invoice.status.toUpperCase()}` +
      upiString +
      `\n_Thank you for choosing ClinicX!_`;

    const encodedMessage = encodeURIComponent(message);
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        await Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodedMessage}`);
        return true;
      }
    } catch {
      return false;
    }
  },

  /**
   * Share a local file (e.g. PDF prescription or lab scan) via Native Share Sheet
   */
  async shareFile(fileUri: string, mimeType: string = 'application/pdf'): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) return false;

      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Share Document',
        UTI: 'com.adobe.pdf',
      });
      return true;
    } catch {
      return false;
    }
  },
};
