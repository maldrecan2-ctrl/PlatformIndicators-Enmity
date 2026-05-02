import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // ÇÖKME (CRASH) SEBEBİNİN KESİN TEŞHİSİ:
      // Son sürümde "Nesneler donuktur (frozen)" diye korkup, gelen mesaj nesnelerini tamamen kopyalayıp
      // sahte (Object.assign) nesnelerle değiştirmiştim. Discord'un altyapısı bu sahte nesneleri görünce
      // "Bu orijinal mesaj objesi değil!" diyerek tüm uygulamayı çökertmiş.
      // Halbuki ilk testteki gibi nesneleri değiştirmeden direkt içindeki yazıya ekleme yaparsak ASLA ÇÖKMÜYOR!

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          if (!PresenceStore) PresenceStore = getByProps("getState", "getPresence") || getByProps("clientStatuses");
          if (!UserStore) UserStore = getByProps("getUser", "getCurrentUser");
          if (!SessionStore) SessionStore = getByProps("getSessions");

          if (!PresenceStore || !UserStore) return "";
          
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
          } catch(e) {
              return ""; 
          }
          
          if (!statuses) return ""; 
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return "";
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          if (platforms.includes("vr")) icons.push("🥽");
          
          if (icons.length === 0) return "";

          return " " + icons.join("");
      };

      const Dispatcher = getByProps('dispatch', 'subscribe');
      
      if (Dispatcher) {
          Patcher.before(Dispatcher, 'dispatch', (self, args) => {
              try {
                  const event = args[0];
                  if (!event) return;

                  if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE" || event.type === "MESSAGE_SEND") {
                      if (event.message && event.message.author) {
                          const iconsStr = getPlatformString(event.message.author.id);
                          if (iconsStr && iconsStr !== "") {
                              const author = event.message.author;
                              const currentGlobalName = author.global_name || author.username;
                              
                              // Asla objeyi klonlama! Sadece yazıyı (string) direkt güncelle. 
                              // Eğer obje donuksa try/catch sayesinde sessizce iptal olur, uygulama ÇÖKMEZ!
                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                  if (author.global_name) {
                                      author.global_name += iconsStr;
                                  } else {
                                      author.username += iconsStr;
                                  }
                              }
                          }
                      }
                  } 
                  else if (event.type === "LOAD_MESSAGES_SUCCESS") {
                      if (Array.isArray(event.messages)) {
                          event.messages.forEach((m: any) => {
                              if (m && m.author) {
                                  const iconsStr = getPlatformString(m.author.id);
                                  if (iconsStr && iconsStr !== "") {
                                      const currentGlobalName = m.author.global_name || m.author.username;
                                      if (!currentGlobalName.includes(iconsStr.trim())) {
                                          if (m.author.global_name) {
                                              m.author.global_name += iconsStr;
                                          } else {
                                              m.author.username += iconsStr;
                                          }
                                      }
                                  }
                              }
                          });
                      }
                  }
                  else if (event.type === "GUILD_MEMBER_LIST_UPDATE") {
                      if (Array.isArray(event.groups)) {
                          event.groups.forEach((group: any) => {
                              if (Array.isArray(group.items)) {
                                  group.items.forEach((item: any) => {
                                      if (item.member && item.member.user) {
                                          const iconsStr = getPlatformString(item.member.user.id);
                                          if (iconsStr && iconsStr !== "") {
                                              const user = item.member.user;
                                              const currentGlobalName = user.global_name || user.username;
                                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                                  if (user.global_name) {
                                                      user.global_name += iconsStr;
                                                  } else {
                                                      user.username += iconsStr;
                                                  }
                                              }
                                          }
                                      }
                                  });
                              }
                          });
                      }
                  }
              } catch (e) {}
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
