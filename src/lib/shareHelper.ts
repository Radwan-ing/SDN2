import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64 = base64data.substring(base64data.indexOf(',') + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export async function sharePdfFile(blob: Blob, filename: string, message: string): Promise<boolean> {
  console.log('Attempting to share file:', filename, 'isNative:', Capacitor.isNativePlatform());
  
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      
      // Save file in Cache directory
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      console.log('File written natively to:', writeResult.uri);
      
      // Share natively
      await Share.share({
        title: 'مشاركة الملف',
        text: message,
        files: [writeResult.uri],
        dialogTitle: 'مشاركة عبر',
      });
      
      return true;
    } catch (error) {
      console.error('Capacitor native share error:', error);
      // Fallback below
    }
  }

  // Web Browser Sharing / Fallback
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: message,
      });
      return true;
    }
  } catch (webShareError) {
    console.warn('Web Share API failed:', webShareError);
  }

  return false;
}
