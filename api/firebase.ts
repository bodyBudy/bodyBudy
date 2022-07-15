import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  where,
  query,
  addDoc,
  documentId,
  orderBy,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore/lite';
import { postingType, usertype, MakeQueryParam, commentType } from './firebase.type';
import { getStorage, getDownloadURL, ref, uploadString } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MSG_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage();

const userCollection = collection(db, 'user');
const communityCollection = collection(db, 'community');
const commentsCollection = collection(db, 'comments');
const trainerCollection = collection(db, 'trainer');
export const chatCollection = collection(db, 'chat');

export const makeQuery = ({ id, option, outerCollection, innerCollection }: MakeQueryParam) =>
  query(collection(db, `${outerCollection}/${id}/${innerCollection}`), orderBy(option));

// 회원가입
export const checkIsNicknameDuplicated = async (nickname: string) => {
  try {
    let user = '';

    const q = query(userCollection, where('nickname', '==', nickname));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      user = doc.id;
    });

    if (user.length) {
      return true;
    }

    return false;
  } catch (e) {
    console.log(e);
  }
};

export const signUpMember = async ({
  nickname,
  email,
  gender,
  city,
  district,
  signUpway,
}: usertype) => {
  try {
    await addDoc(collection(db, 'user'), {
      nickname,
      email,
      gender,
      city,
      district,
      signUpway,
      isWithdrawal: false,
      thumbnail: '',
    });
  } catch (e) {
    console.log(e);
  }
};

export const fetchUserNickname = async (id: string) => {
  try {
    const docRef = doc(db, 'user', id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    return data.nickname;
  } catch (e) {
    console.log(e);
  }
};

export const fetchPostingMetaInfo = async (postId: string) => {
  try {
    const q = query(commentsCollection, where('communityId', '==', postId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.length;
  } catch (e) {
    console.log(e);
  }
};

export const fetchPostingsByField = async (field: string) => {
  try {
    const q = query(communityCollection, where('fieldId', '==', field));
    const querySnapshot = await getDocs(q);
    const promises = querySnapshot.docs.map((doc) => {
      let data = doc.data();
      return fetchUserNickname(data.userId)
        .then((result) => {
          data = {
            ...data,
            nickname: result,
          };
        })
        .then((_) => fetchPostingMetaInfo(doc.id))
        .then((result) => {
          data = {
            ...data,
            id: doc.id,
            totalComments: result,
            creationDate: data.creationDate.toDate() + '',
          };
          return data;
        });
    });

    return Promise.all(promises).then((result) =>
      result.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate))
    );
  } catch (e) {
    console.log(e);
  }
};

export const fetchPostingDetailById = async (postId: string) => {
  try {
    const docRef = doc(db, 'community', postId);
    const docSnap = await getDoc(docRef);
    let data = docSnap.data();
    data = {
      ...data,
      nickname: await fetchUserNickname(data.userId),
      creationDate: data.creationDate.toDate() + '',
    };
    return data;
  } catch (e) {
    console.log(e);
  }
};

export const fetchCommentsById = async (postId: string) => {
  try {
    const q = query(commentsCollection, where('communityId', '==', postId));
    const querySnapshot = await getDocs(q);

    const promises = querySnapshot.docs.map((doc) => {
      let data = doc.data();
      return fetchUserNickname(data.userId).then((result) => {
        data = {
          id: doc.id,
          nickname: result,
          ...data,
          creationDate: data.creationDate.toDate() + '',
        };
        return data;
      });
    });
    return Promise.all(promises).then((result) =>
      result.sort((a, b) => new Date(a.creationDate) - new Date(b.creationDate))
    );
  } catch (e) {
    console.log(e);
  }
};

export const addCommunityPosting = async (posting: postingType) => {
  try {
    const promises = posting.images
      .filter((image) => image)
      .map((image) => {
        const name = `image${Date.now()}.jpg`;
        return uploadString(ref(storage, name), image.split(',')[1], 'base64').then(() => {
          return getDownloadURL(ref(storage, name));
        });
      });
    Promise.all(promises).then((result) => {
      addDoc(collection(db, 'community'), { ...posting, images: result });
    });
  } catch (e) {
    console.log(e);
  }
};

export const updateCommunityPosting = async (postId: string, posting: postingType) => {
  try {
    const promises = posting.images
      .filter((image) => image)
      .map((image) => {
        if (image.includes('firebasestorage')) return image;
        const name = `image${Date.now()}.jpg`;
        return uploadString(ref(storage, name), image.split(',')[1], 'base64').then(() => {
          return getDownloadURL(ref(storage, name));
        });
      });
    Promise.all(promises).then((result) => {
      const docRef = doc(db, 'community', postId);
      updateDoc(docRef, { title: posting.title, content: posting.content, images: result });
    });
  } catch (e) {
    console.log(e);
  }
};

export const deleteCommunityPosting = async (postId: string) => {
  try {
    await deleteDoc(doc(db, 'community', postId));
  } catch (e) {
    console.log(e);
  }
};

export const addCommunityComment = async (comment: commentType) => {
  try {
    addDoc(collection(db, 'comments'), comment);
    return fetchUserNickname(comment.userId);
  } catch (e) {
    console.log(e);
  }
};

export const updateCommunityComment = async (commentId: string, content: string) => {
  try {
    const docRef = doc(db, 'comments', commentId);
    updateDoc(docRef, { content });
  } catch (e) {
    console.log(e);
  }
};

export const deleteCommunityComment = async (commentId: string) => {
  try {
    await deleteDoc(doc(db, 'comments', commentId));
  } catch (e) {
    console.log(e);
  }
};

export const getTrainerData = async (id: string) => {
  try {
    const q = query(trainerCollection, where(documentId(), '==', id));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((x) => ({ ...x.data(), id: id }));
  } catch (e) {
    console.log(e);
  }
};
