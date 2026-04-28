import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LOCAL_USER_ID } from './auth';
import { storage } from './firebase';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1 * 1024 * 1024;
const ALLOWED_EXTS = ['mp3'];
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp3', ''];
const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
};

export const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';
export const getAudioContentTypeFromExtension = (ext = '') => MIME_BY_EXT[ext] || '';

export const validateAudioFile = (file) => {
  if (!file) return 'Please select an audio file.';
  const ext = getFileExtension(file.name);
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return 'Only MP3 files are currently supported. Convert m4a files to MP3 before uploading.';
  }
  if (file.size > MAX_BYTES) {
    return 'Files larger than 20MB cannot be uploaded.';
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Only MP3 files are currently supported. Convert m4a files to MP3 before uploading.';
  }
  return null;
};

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file.'));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to process image.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export const validateImageFile = (file) => {
  if (!file) return null;
  const ext = getFileExtension(file.name);
  if (!ext || !ALLOWED_IMAGE_EXTS.includes(ext)) {
    return 'Supported image formats: jpg, jpeg, png, webp.';
  }
  if (file.type && !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return 'Supported image formats: jpg, jpeg, png, webp.';
  }
  return null;
};

export const compressLessonImage = async ({ file, maxDimension = 1200, quality = 0.8 }) => {
  const image = await loadImageElement(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to process image.');
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  if (blob.size > MAX_IMAGE_BYTES) {
    blob = await canvasToBlob(canvas, 'image/jpeg', Math.max(0.6, quality - 0.15));
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('Compressed image must be 1MB or less.');
  }
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `lesson-image.${extension}`, { type: blob.type });
};

export const uploadLessonAudio = async ({ file }) => {
  const ext = getFileExtension(file.name);
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const audioPath = `users/${LOCAL_USER_ID}/lesson-audio/${filename}`;
  const storageRef = ref(storage, audioPath);
  const contentType = 'audio/mpeg';
  const metadata = { contentType };
  await uploadBytes(storageRef, file, metadata);
  const audioUrl = await getDownloadURL(storageRef);
  return { audioPath, audioUrl, audioContentType: contentType, fileExtension: ext };
};

export const uploadLessonImage = async ({ file, lessonId }) => {
  if (!lessonId) throw new Error('Lesson ID is required for image upload.');
  const ext = getFileExtension(file.name) || 'webp';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const imagePath = `users/${LOCAL_USER_ID}/lesson-images/${lessonId}/${filename}`;
  const storageRef = ref(storage, imagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || 'image/webp' });
  const imageUrl = await getDownloadURL(storageRef);
  return { imagePath, imageUrl };
};

export const getAudioDownloadUrlByPath = async (audioPath) => {
  if (!audioPath) return '';
  const storageRef = ref(storage, audioPath);
  return getDownloadURL(storageRef);
};

export const deleteAudioByPath = async (audioPath) => {
  if (!audioPath) return;
  await deleteObject(ref(storage, audioPath));
};

export const deleteImageByPath = async (imagePath) => {
  if (!imagePath) return;
  await deleteObject(ref(storage, imagePath));
};
