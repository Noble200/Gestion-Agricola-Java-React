import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateEmail,
  updatePassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  orderBy,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';

const createMinimalPermissions = () => {
  return {
    dashboard: true,
    activities: false,
    products: false,
    transfers: false,
    purchases: false,
    expenses: false,
    fumigations: false,
    harvests: false,
    fields: false,
    warehouses: false,
    reports: false,
    users: false,
    admin: false
  };
};

const createDefaultPermissions = (role = 'user') => {
  switch (role) {
    case 'admin':
      return {
        dashboard: true,
        activities: true,
        products: true,
        transfers: true,
        purchases: true,
        expenses: true,
        fumigations: true,
        harvests: true,
        fields: true,
        warehouses: true,
        reports: true,
        users: true,
        admin: true
      };
    
    case 'manager':
      return {
        dashboard: true,
        activities: false,
        products: true,
        transfers: true,
        purchases: true,
        expenses: true,
        fumigations: true,
        harvests: true,
        fields: true,
        warehouses: true,
        reports: true,
        users: false,
        admin: false
      };
    
    case 'operator':
      return {
        dashboard: true,
        activities: false,
        products: true,
        transfers: true,
        fumigations: true,
        harvests: true,
        fields: false,
        warehouses: false,
        purchases: false,
        expenses: false,
        reports: false,
        users: false,
        admin: false
      };
    
    case 'viewer':
      return {
        dashboard: true,
        activities: false,
        products: true,
        transfers: false,
        purchases: false,
        expenses: false,
        fumigations: false,
        harvests: false,
        fields: false,
        warehouses: false,
        reports: false,
        users: false,
        admin: false
      };
    
    default: // 'user'
      return {
        dashboard: true,
        activities: false,
        products: false,
        transfers: false,
        purchases: false,
        expenses: false,
        fumigations: false,
        harvests: false,
        fields: false,
        warehouses: false,
        reports: false,
        users: false,
        admin: false
      };
  }
};

const usersService = {
  login: async (email, password) => {
    try {
      console.log('Iniciando proceso de login con email...');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login exitoso con ID:', user.uid);

      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        const basicUserData = {
          id: user.uid,
          email: user.email,
          username: user.email.split('@')[0],
          displayName: user.email.split('@')[0],
          role: 'user',
          permissions: createMinimalPermissions()
        };

        await setDoc(doc(db, 'users', user.uid), basicUserData);
        
        return {
          uid: user.uid,
          ...basicUserData,
          emailVerified: user.emailVerified,
          isNewUser: true
        };
      }

      const userData = userDoc.data();
      
      let permissions = userData.permissions || createMinimalPermissions();
      
      if (!permissions.dashboard) {
        permissions.dashboard = true;
      }
      
      return {
        uid: user.uid,
        email: user.email,
        username: userData.username || user.email.split('@')[0],
        displayName: userData.displayName || user.email.split('@')[0],
        emailVerified: user.emailVerified,
        role: userData.role || 'user',
        permissions: permissions
      };
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  },

  loginWithUsername: async (username, password) => {
    try {
      console.log('Iniciando proceso de login con nombre de usuario...');
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('Nombre de usuario no encontrado:', username);
        throw { code: 'username-not-found', message: 'Nombre de usuario no encontrado' };
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const email = userData.email;
      
      if (!email) {
        throw new Error('Usuario sin correo electrónico asociado');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login exitoso con ID:', user.uid);
      
      let permissions = userData.permissions || createMinimalPermissions();
      
      if (!permissions.dashboard) {
        permissions.dashboard = true;
      }
      
      return {
        uid: user.uid,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName || userData.username,
        emailVerified: user.emailVerified,
        role: userData.role || 'user',
        permissions: permissions
      };
    } catch (error) {
      console.error('Error al iniciar sesión con nombre de usuario:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      console.log('Iniciando proceso de cierre de sesión');
      await signOut(auth);
      console.log('Sesión cerrada correctamente');
      return true;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  },

  getCurrentUser: async () => {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, 
        (user) => {
          unsubscribe();
          resolve(user);
        },
        (error) => {
          reject(error);
        }
      );
    });
  },

  isAuthenticated: async () => {
    const user = await usersService.getCurrentUser();
    return user !== null;
  },

  createUser: async (userData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('El correo y la contraseña son obligatorios');
      }
      
      if (userData.username) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', userData.username));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          throw new Error('El nombre de usuario ya está en uso');
        }
      }
      
      const userCredential = await createUserWithEmailAndPassword(
        auth, userData.email, userData.password
      );
      
      const user = userCredential.user;
      
      const { password, sendVerification, ...userDataForDB } = userData;
      
      const dataWithDefaults = {
        id: user.uid,
        email: user.email,
        username: userData.username || user.email.split('@')[0],
        displayName: userData.displayName || userData.username || user.email.split('@')[0],
        role: userData.role || 'user',
        permissions: userData.permissions || createMinimalPermissions(),
        createdAt: new Date()
      };
      
      if (!dataWithDefaults.permissions.dashboard) {
        dataWithDefaults.permissions.dashboard = true;
      }
      
      await setDoc(doc(db, 'users', user.uid), dataWithDefaults);
      
      return user.uid;
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  },

  updateUser: async (userId, userData) => {
    try {
      const { password, email, uid, ...updateData } = userData;
      
      if (updateData.username) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', updateData.username));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty && querySnapshot.docs[0].id !== userId) {
          throw new Error('El nombre de usuario ya está en uso');
        }
      }
      
      if (updateData.permissions) {
        if (!updateData.permissions.dashboard) {
          updateData.permissions.dashboard = true;
        }
      }
      
      const dbUpdateData = {
        ...updateData,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(db, 'users', userId), dbUpdateData);
      
      return userId;
    } catch (error) {
      console.error(`Error al actualizar usuario ${userId}:`, error);
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');
      
      await updatePassword(user, newPassword);
      return true;
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  },
  
  changeEmail: async (password, newEmail) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');
      
      await updateEmail(user, newEmail);
      
      await updateDoc(doc(db, 'users', user.uid), { 
        email: newEmail, 
        updatedAt: new Date() 
      });
      
      return true;
    } catch (error) {
      console.error('Error al cambiar correo electrónico:', error);
      throw error;
    }
  },
  
  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de restablecimiento:', error);
      throw error;
    }
  },
  
  getAllUsers: async () => {
    try {
      const usersQuery = query(collection(db, 'users'), orderBy('displayName'));
      const querySnapshot = await getDocs(usersQuery);
      
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return users;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },
  
  getUserById: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) return null;
      
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        role: userData.role,
        permissions: userData.permissions
      };
    } catch (error) {
      console.error(`Error al obtener usuario ${userId}:`, error);
      throw error;
    }
  },
  
  updateUserPermissions: async (userId, permissions) => {
    try {
      const finalPermissions = { ...permissions };
      if (!finalPermissions.dashboard) {
        finalPermissions.dashboard = true;
      }
      
      await updateDoc(doc(db, 'users', userId), { 
        permissions: finalPermissions,
        updatedAt: new Date() 
      });
      
      return userId;
    } catch (error) {
      console.error(`Error al actualizar permisos del usuario ${userId}:`, error);
      throw error;
    }
  },
  
  hasPermission: async (permission) => {
    try {
      const user = auth.currentUser;
      
      if (!user) {
        return false;
      }
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      
      if (userData.permissions?.admin === true) {
        return true;
      }
      
      return userData.permissions?.[permission] === true;
    } catch (error) {
      console.error(`Error al verificar permiso ${permission}:`, error);
      return false;
    }
  },

  verifySession: async () => {
    try {
      const user = auth.currentUser;
      return user !== null;
    } catch (error) {
      console.error('Error en verifySession:', error);
      return false;
    }
  }
};

export default usersService;
