import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LOCAL_USER_ID } from './auth';
import { storage } from './firebase';

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTS = ['mp3', 'm4a', 'wav'];
const ALLOWED_MIME_PREFIX = 'audio/';
const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

export const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';
export const getAudioContentTypeFromExtension = (ext = '') => MIME_BY_EXT[ext] || '';

export const validateAudioFile = (file) => {
  if (!file) return '音声ファイルを選択してください。';
  const ext = getFileExtension(file.name);
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return '音声ファイルは mp3 / m4a / wav のみ対応しています。';
  }
  if (file.size > MAX_BYTES) {
    return '20MBを超えるファイルはアップロードできません。';
  }
  if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
    return 'audio系のファイルのみアップロードできます。';
  }
  return null;
};

export const uploadLessonAudio = async ({ file }) => {
  const ext = getFileExtension(file.name);
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const audioPath = `users/${LOCAL_USER_ID}/lesson-audio/${filename}`;
  const storageRef = ref(storage, audioPath);
  const contentType = getAudioContentTypeFromExtension(ext) || file.type || 'audio/mpeg';
  const metadata = { contentType };
  await uploadBytes(storageRef, file, metadata);
  const audioUrl = await getDownloadURL(storageRef);
  return { audioPath, audioUrl, audioContentType: contentType, fileExtension: ext };
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
