import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LOCAL_USER_ID } from './auth';
import { storage } from './firebase';

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTS = ['mp3'];
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp3', ''];
const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
};

export const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';
export const getAudioContentTypeFromExtension = (ext = '') => MIME_BY_EXT[ext] || '';

export const validateAudioFile = (file) => {
  if (!file) return '音声ファイルを選択してください。';
  const ext = getFileExtension(file.name);
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return '現在はmp3ファイルのみ登録できます。m4a等はmp3に変換してから登録してください。';
  }
  if (file.size > MAX_BYTES) {
    return '20MBを超えるファイルはアップロードできません。';
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return '現在はmp3ファイルのみ登録できます。m4a等はmp3に変換してから登録してください。';
  }
  return null;
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

export const getAudioDownloadUrlByPath = async (audioPath) => {
  if (!audioPath) return '';
  const storageRef = ref(storage, audioPath);
  return getDownloadURL(storageRef);
};

export const deleteAudioByPath = async (audioPath) => {
  if (!audioPath) return;
  await deleteObject(ref(storage, audioPath));
};
