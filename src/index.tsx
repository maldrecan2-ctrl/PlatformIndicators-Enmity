import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const { Text } = getByProps("View", "Text") || {};
const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      const getModules = () => {
          try {
              return (window as any).enmity?.metro?.getModules?.() || [];
          } catch(e) {
              return [];
          }
      };

      const findByName = (name: string) => {
          for (const m of getModules()) {
              if (m && m.default && m.default.name === name) return m;
              if (m && m.name === name) return m;
              if (m && m.default && m.default.displayName === name) return m;
              if (m && m.displayName === name) return m;
          }
          return null;
      };

      const getStore = (name: string) => {
          try {
              return (window as any).enmity?.metro?.getByStoreName?.(name) || null;
          } catch (e) {
              return null;
          }
      };

      const PresenceStore = getStore("PresenceStore") || getByProps("getState", "getPresence");
      const SessionStore = getStore("SessionsStore") || getByProps("getSessions");
      const UserStore = getStore("UserStore") || getByProps("getCurrentUser");

      // ÖNCEKİ HATANIN KAYNAĞI: React Native'de <Text> içine <View> konulmaz.
      // Bu yüzden sadece string veya <Text> dönmeliyiz!
      const getPlatformString = (userId: string) => {
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
                  const state = PresenceStore.getState();
                  if (state && state.clientStatuses) {
                      statuses = state.clientStatuses[userId];
                  }
              }
          } catch(e) {
              return " ⚠️"; 
          }
          
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

          return " " + icons.join(" ");
      };

      const patchComponent = (module: any, prop: string, callback: any) => {
          if (!module || !module[prop]) return;
          if (typeof module[prop] === "function") {
              Patcher.after(module, prop, callback);
          } else if (typeof module[prop] === "object") {
              if (module[prop].type) Patcher.after(module[prop], "type", callback);
              else if (module[prop].render) Patcher.after(module[prop], "render", callback);
              else Patcher.after(module, prop, callback);
          }
      };

      // 1. Profil İsimleri (DisplayName)
      const DisplayNameModule = getByProps("DisplayName");
      if (DisplayNameModule) {
          patchComponent(DisplayNameModule, "DisplayName", (self: any, args: any, res: any) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;
                  const iconsStr = getPlatformString(user.id);
                  if (!iconsStr) return res;

                  if (res && res.props) {
                      const originalChildren = res.props.children;
                      // Text içine Text koymak güvenlidir veya direkt string birleştirmek
                      res.props.children = (
                          <Text>
                              {originalChildren}
                              <Text>{iconsStr}</Text>
                          </Text>
                      );
                  }
              } catch (e) {}
              return res;
          });
      }

      // 2. Üye Listesi Satırları (GuildMemberRow / MemberListItem / UserRow)
      const memberModules = [
          getByProps("GuildMemberRow"),
          getByProps("MemberListItem"),
          findByName("UserRow"),
          findByName("MemberListItem"),
          findByName("GuildMemberRow")
      ];

      memberModules.forEach(mod => {
          if (!mod) return;
          const propName = mod.default ? "default" : (mod.MemberListItem ? "MemberListItem" : (mod.GuildMemberRow ? "GuildMemberRow" : (mod.UserRow ? "UserRow" : null)));
          if (propName) {
              patchComponent(mod, propName, (self: any, args: any, res: any) => {
                  try {
                      const user = args[0]?.user;
                      if (!user) return res;
                      const iconsStr = getPlatformString(user.id);
                      if (!iconsStr) return res;

                      // Üye satırı genelde bir View döndürür ama ismin olduğu Text'i bulmak zor.
                      // En güvenlisi: Bütün satırı sarmalamak yerine, props.children dizisinin sonuna Text olarak eklemek
                      // Veya eğer res.props.children bir diziyse, en sona eklemek
                      if (res && res.props && Array.isArray(res.props.children)) {
                          res.props.children.push(<Text key="platform-icons" style={{ alignSelf: 'center' }}>{iconsStr}</Text>);
                      }
                  } catch (e) {}
                  return res;
              });
          }
      });

      // 3. Sohbet Mesajları (MessageHeader)
      const MessageTimestamp = getByProps("MessageTimestamp");
      if (MessageTimestamp) {
          patchComponent(MessageTimestamp, "default", (self: any, args: any, res: any) => {
              try {
                  const message = args[0]?.message;
                  if (!message || !message.author) return res;
                  const iconsStr = getPlatformString(message.author.id);
                  if (!iconsStr) return res;

                  if (res && res.props && Array.isArray(res.props.children)) {
                      res.props.children.push(<Text key="platform-icons">{iconsStr}</Text>);
                  } else if (res && res.props) {
                      const originalChildren = res.props.children;
                      res.props.children = (
                          <Text>
                              {originalChildren}
                              <Text>{iconsStr}</Text>
                          </Text>
                      );
                  }
              } catch(e) {}
              return res;
          });
      }

      // AŞIRI GARANTİ VERİ YAMASI: (UI Yamaları yine çalışmazsa diye, doğrudan mesaj verisini değiştiriyoruz)
      // Bu yama Enmity'de SecretMessage'da çalıştığı gibi kesin çalışacaktır!
      const FluxDispatcher = getByProps("dispatch", "subscribe");
      if (FluxDispatcher) {
          Patcher.before(FluxDispatcher, "dispatch", (self, args) => {
              try {
                  const event = args[0];
                  if (event && (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE")) {
                      if (event.message && event.message.author) {
                          const iconsStr = getPlatformString(event.message.author.id);
                          if (iconsStr && event.message.content !== undefined) {
                              // Sadece mesajın sonuna ikonu ekle (sadece sohbet için kesin çözüm)
                              if (!event.message.content.includes(iconsStr)) {
                                  // Mesaj metnine dokunmamak için yazar adını (username) değiştirmeyi deneriz, 
                                  // ama username değişimi bazı yerlerde patlayabilir.
                                  // Bu yüzden mesaj içeriğinin en sonuna ekliyoruz (SecretMessage mantığı)
                                  // event.message.content += ` ${iconsStr}`;
                                  
                                  // Aslında en mantıklısı yazar ismine eklemek!
                                  if (!event.message.author.global_name?.includes(iconsStr) && !event.message.author.username.includes(iconsStr)) {
                                      if (event.message.author.global_name) {
                                          event.message.author.global_name += iconsStr;
                                      } else {
                                          event.message.author.username += iconsStr;
                                      }
                                  }
                              }
                          }
                      }
                  } else if (event && event.type === "LOAD_MESSAGES_SUCCESS") {
                      if (Array.isArray(event.messages)) {
                          event.messages.forEach((m: any) => {
                              if (m && m.author) {
                                  const iconsStr = getPlatformString(m.author.id);
                                  if (iconsStr) {
                                      if (!m.author.global_name?.includes(iconsStr) && !m.author.username.includes(iconsStr)) {
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
              } catch(e) {}
          });
      }

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
