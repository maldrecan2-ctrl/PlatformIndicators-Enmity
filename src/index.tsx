import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // ÇÖKME SEBEBİ BULUNDU: Veritabanlarını bulmak için yazdığım "tüm modülleri tara" (getModules) kodu,
      // saniyede binlerce kez tetiklenen FluxDispatcher (Veri Akışı) içine girince telefonun işlemcisini
      // veya belleğini kilitleyip uygulamanın çökmesine (Freeze/Crash) sebep oluyormuş!
      // Bu yüzden o tehlikeli tarama kodunu tamamen sildim. Çok daha güvenli ve hafif olan standart bulucuya döndüm.

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          // Eğer önceden bulduysak tekrar tekrar Discord'u yormamak için hafızadan kullanıyoruz (ÇÖKMEYİ ENGELLER)
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
                              
                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                  // Nesnelerin donmuş (frozen) olma ihtimaline karşı tamamen kopyalıyoruz
                                  event.message = Object.assign({}, event.message, {
                                      author: Object.assign({}, author, {
                                          global_name: currentGlobalName + iconsStr,
                                          username: author.username + iconsStr
                                      })
                                  });
                              }
                          }
                      }
                  } 
                  else if (event.type === "LOAD_MESSAGES_SUCCESS") {
                      if (Array.isArray(event.messages)) {
                          event.messages = event.messages.map((m: any) => {
                              if (m && m.author) {
                                  const iconsStr = getPlatformString(m.author.id);
                                  if (iconsStr && iconsStr !== "") {
                                      const currentGlobalName = m.author.global_name || m.author.username;
                                      if (!currentGlobalName.includes(iconsStr.trim())) {
                                          return Object.assign({}, m, {
                                              author: Object.assign({}, m.author, {
                                                  global_name: currentGlobalName + iconsStr,
                                                  username: m.author.username + iconsStr
                                              })
                                          });
                                      }
                                  }
                              }
                              return m;
                          });
                      }
                  }
                  else if (event.type === "GUILD_MEMBER_LIST_UPDATE") {
                      if (Array.isArray(event.groups)) {
                          event.groups.forEach((group: any) => {
                              if (Array.isArray(group.items)) {
                                  group.items.forEach((item: any, index: number) => {
                                      if (item.member && item.member.user) {
                                          const iconsStr = getPlatformString(item.member.user.id);
                                          if (iconsStr && iconsStr !== "") {
                                              const user = item.member.user;
                                              const currentGlobalName = user.global_name || user.username;
                                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                                  // Orijinal item bozulmasın diye kopyalıyoruz
                                                  group.items[index] = Object.assign({}, item, {
                                                      member: Object.assign({}, item.member, {
                                                          user: Object.assign({}, user, {
                                                              global_name: currentGlobalName + iconsStr,
                                                              username: user.username + iconsStr
                                                          })
                                                      })
                                                  });
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
