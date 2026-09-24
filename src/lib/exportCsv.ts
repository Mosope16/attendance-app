import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface CsvExportOptions {
  filename: string;
  rows: (string | number | boolean | null | undefined)[][];
  dialogTitle?: string;
}

/**
 * Escapes a single CSV cell value according to RFC 4180
 */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Universally export and print/share a CSV file across Web, Android, and iOS.
 */
export async function exportCsv({
  filename,
  rows,
  dialogTitle = 'Export / Print Attendance CSV',
}: CsvExportOptions): Promise<boolean> {
  try {
    if (!rows || rows.length === 0) {
      Alert.alert('Empty Data', 'There are no records to export.');
      return false;
    }

    // Prepend UTF-8 BOM (\uFEFF) for optimal Excel compatibility on Windows and macOS
    const csvContent =
      '\uFEFF' +
      rows
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');

    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

    if (Platform.OS === 'web') {
      // Browser environment: trigger direct file download
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', cleanFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return true;
      }
      return false;
    }

    // Native Mobile (Android & iOS)
    let fileUri = '';
    try {
      const baseDir =
        (FileSystem as any).cacheDirectory ||
        (FileSystem as any).documentDirectory ||
        (FileSystem as any).Paths?.cache?.uri ||
        '';

      fileUri = baseDir.endsWith('/') ? `${baseDir}${cleanFilename}` : `${baseDir}/${cleanFilename}`;

      if (typeof (FileSystem as any).writeAsStringAsync === 'function') {
        await (FileSystem as any).writeAsStringAsync(fileUri, csvContent, {
          encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
        });
      } else if ((FileSystem as any).File && (FileSystem as any).Paths?.cache) {
        const file = new (FileSystem as any).File((FileSystem as any).Paths.cache, cleanFilename);
        await file.write(csvContent);
        fileUri = file.uri;
      }
    } catch (fsErr) {
      console.warn('FileSystem write fallback triggered:', fsErr);
      if ((FileSystem as any).File && (FileSystem as any).Paths?.cache) {
        const file = new (FileSystem as any).File((FileSystem as any).Paths.cache, cleanFilename);
        await file.write(csvContent);
        fileUri = file.uri;
      } else {
        throw fsErr;
      }
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle,
        UTI: 'public.comma-separated-values-text',
      });
      return true;
    } else {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      return false;
    }
  } catch (err: any) {
    console.error('Error exporting CSV:', err);
    Alert.alert('Export Error', err?.message || 'Failed to export CSV file.');
    return false;
  }
}
