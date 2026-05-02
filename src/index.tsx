import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // PROXY TAKTİĞİ: Arayüz (UI) yamaları Discord 261.0 sürümünde tamamen değiştiği ve bozuk olduğu için
      // doğrudan Discord'un veritabanlarından çıkan nesnelere (örneğin Kullanıcı Nesnesi) bir ajan (Proxy) takıyoruz.
      // Bu ajan, Discord "Bu kullanıcının ismi ne?" diye sorduğu anda araya girip ismin sonuna emojiyi ekliyor.
      // Obje donmuş (frozen) olsa bile Proxy ile bu engeli %100 aşıyoruz!

      const getByStoreName = (name: string) => {
          try {
              const modules = (window as any).enmity?.metro?.getModules?.() || [];
              for (const m of modules) {
                  if (m && m.default && typeof m.default.getName === "function" && m.default.getName() === name) return m.default;
                  if (m && typeof m.getName === "function" && m.getName() === name) return m;
              }
          } catch(e) {}
          return null;
      };

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          if (!PresenceStore) PresenceStore = getByStoreName("PresenceStore");
          if (!UserStore) UserStore = getByStoreName("UserStore");
          if (!SessionStore) SessionStore = getByStoreName("SessionsStore");

          if (!PresenceStore || !UserStore) return null;
          
          let statuses;
          try {
              const currentUser = UserStore.getCurrentUser();
              if (currentUser && userId === currentUser.id && SessionStore) {
                  const sessions = SessionStore.getSessions() || {};
                  statuses = {};
                  Object.values(sessions).forEach((s: any) => {
                      if (s.clientInfo && s.clientInfo.client !== "unknown") {
                          statuses[s.clientInfo.client] = s.status;
                      }
                  });
              } else {
                  statuses = PresenceStore.getState()?.clientStatuses?.[userId];
              }
          } catch(e) {}
          
          if (!statuses) return null; 
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return null;
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          if (platforms.includes("vr")) icons.push("🥽");
          
          if (icons.length === 0) return null;

          return " " + icons.join("");
      };

      const proxiedUsers = new WeakMap();

      const createUserProxy = (userObj: any) => {
          if (!userObj || typeof userObj !== "object") return userObj;
          if (proxiedUsers.has(userObj)) return proxiedUsers.get(userObj);

          const proxy = new Proxy(userObj, {
              get(target, prop) {
                  const val = target[prop];
                  // Eğer Discord kullanıcının ismini (username veya globalName) ekrana çizmek için okuyorsa:
                  if (prop === "username" || prop === "globalName") {
                      if (typeof val === "string") {
                          const icons = getPlatformString(target.id);
                          if (icons && !val.includes(icons.trim())) {
                              return val + icons;
                          }
                      }
                  }
                  return val;
              }
          });

          proxiedUsers.set(userObj, proxy);
          return proxy;
      };

      const proxiedMembers = new WeakMap();

      const createMemberProxy = (memberObj: any) => {
          if (!memberObj || typeof memberObj !== "object") return memberObj;
          if (proxiedMembers.has(memberObj)) return proxiedMembers.get(memberObj);

          const proxy = new Proxy(memberObj, {
              get(target, prop) {
                  const val = target[prop];
                  // Üye listelerinde isim genellikle 'nick' veya member.user.username üzerinden okunur
                  if (prop === "nick") {
                      if (typeof val === "string") {
                          const userId = target.userId;
                          const icons = getPlatformString(userId);
                          if (icons && !val.includes(icons.trim())) {
                              return val + icons;
                          }
                      } else if (!val) {
                          // Eğer sunucu takma adı (nick) yoksa sadece ikon döndürebiliriz ki ismin yanına yapışsın
                          // Ama genelde nick yoksa user objesinden ismi çeker, o yüzden dokunmamak daha iyi olabilir.
                          // Yine de güvenli olsun diye:
                          const userId = target.userId;
                          const icons = getPlatformString(userId);
                          if (icons) return icons;
                      }
                  } else if (prop === "user") {
                      return createUserProxy(val);
                  }
                  return val;
              }
          });

          proxiedMembers.set(memberObj, proxy);
          return proxy;
      };

      const patchStores = () => {
          const userStoreObj = getByStoreName("UserStore");
          if (userStoreObj) {
              Patcher.after(userStoreObj, "getUser", (self, args, res) => {
                  return createUserProxy(res);
              });
              
              Patcher.after(userStoreObj, "getCurrentUser", (self, args, res) => {
                  return createUserProxy(res);
              });

              if (userStoreObj.getUsers) {
                  Patcher.after(userStoreObj, "getUsers", (self, args, res) => {
                      if (res && typeof res === "object") {
                          const newRes: any = {};
                          for (const key in res) {
                              newRes[key] = createUserProxy(res[key]);
                          }
                          return newRes;
                      }
                      return res;
                  });
              }
          }

          const guildMemberStoreObj = getByStoreName("GuildMemberStore");
          if (guildMemberStoreObj) {
              Patcher.after(guildMemberStoreObj, "getMember", (self, args, res) => {
                  return createMemberProxy(res);
              });
          }

          // Mesajların içinde de yazar nesnesi bulunur, orayı da garantiye alalım
          const messageStoreObj = getByStoreName("MessageStore");
          if (messageStoreObj) {
              Patcher.after(messageStoreObj, "getMessage", (self, args, res) => {
                  if (res && res.author) {
                      res.author = createUserProxy(res.author);
                  }
                  return res;
              });
              Patcher.after(messageStoreObj, "getMessages", (self, args, res) => {
                  if (res && res._array) {
                      res._array.forEach((m: any) => {
                          if (m && m.author) m.author = createUserProxy(m.author);
                      });
                  }
                  return res;
              });
          }
      };

      // Gecikmeli yükleme
      setTimeout(patchStores, 2000);
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
