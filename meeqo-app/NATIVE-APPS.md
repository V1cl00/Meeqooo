# MeeQo als App für Android und iOS

Die Apps sind eine native Hülle (Capacitor) um die laufende Seite. Die App selbst (Anmeldung, Datenbank, Chat) bleibt auf dem Server. Dadurch gibt es **eine** Code-Basis, und Änderungen sind sofort in beiden Apps, ohne neue Store-Version. Die Hülle bringt, was eine Webseite nicht kann: Push-Mitteilungen, Vibration, Teilen-Dialog, Statusleiste, Zurück-Taste und Links, die die App öffnen.

Nicht von mir erledigt oder getestet (geht in dieser Umgebung nicht): Bauen der Apps, Start auf Telefon oder Simulator, Store-Einreichung. Die Projekte sind erzeugt, die Brücke ist geschrieben, der Rest sind die Schritte unten.

## Was du brauchst
| Wofür | Was | Kosten |
|---|---|---|
| Server | Die Seite muss unter einer **https-Adresse** laufen (Hoster, Datenbank, Domain) | je nach Hoster |
| Android | Android Studio, Google-Play-Konto | 25 $ einmalig |
| iOS | Ein Mac mit Xcode, Apple-Developer-Konto | 99 $ pro Jahr |
| Mitteilungen | Firebase-Projekt (kostenlos), für iOS zusätzlich ein APNs-Schlüssel aus dem Apple-Konto | 0 |

## Ablauf
```
cd meeqo-app
export CAP_SERVER_URL=https://deine-adresse        # die laufende Seite, https
npm run native:sync                                # kopiert Einstellungen und Plugins
npm run native:android                             # öffnet Android Studio
npm run native:ios                                 # öffnet Xcode (nur auf dem Mac)
```
- `appId` ist `de.meeqo.app` (in `capacitor.config.ts`). Vor der ersten Einreichung entscheiden; später nicht mehr änderbar.
- Symbole und Startbild: Bilder in `resources/` ablegen und `npx @capacitor/assets generate` ausführen (erzeugt alle Größen für beide Stores).
- Ohne Verbindung zeigt die App `native/www/index.html` mit „Nochmal versuchen“.

## Mitteilungen einrichten
1. In der Firebase-Konsole ein Projekt anlegen, eine Android-App (`de.meeqo.app`) und eine iOS-App hinzufügen.
2. `google-services.json` nach `android/app/`, `GoogleService-Info.plist` in Xcode zum App-Ziel hinzufügen.
3. Für iOS in Firebase unter Cloud Messaging den APNs-Schlüssel hochladen. In Xcode die Fähigkeiten „Push Notifications“ und „Background Modes → Remote notifications“ einschalten.
4. Auf dem Server die Umgebungsvariable `FCM_SERVICE_ACCOUNT` setzen: der Inhalt der JSON-Datei eines Firebase-Dienstkontos (Projekteinstellungen → Dienstkonten → neuen Schlüssel erzeugen).
5. In der App: Einstellungen → „Mitteilungen erlauben“. Der Server speichert den Schlüssel pro Gerät (`native_push`) und schickt jede Mitteilung auch an die Telefone. Tote Schlüssel werden automatisch gelöscht.

## Links, die die App öffnen
Einladungslinks (`/einladung/…`) und Vertrauenslinks (`/sicher/…`) sollen die App öffnen, wenn sie installiert ist.
- Android: Datei `/.well-known/assetlinks.json` auf der Seite und in `AndroidManifest.xml` einen `intent-filter` mit `android:autoVerify="true"` für die Adresse.
- iOS: Datei `/.well-known/apple-app-site-association` und in Xcode „Associated Domains“ (`applinks:deine-adresse`).
Beides braucht die Fingerabdrücke aus dem Signieren der App; deshalb erst nach dem ersten Signieren.

## Wichtig für die Prüfung der Stores
- **Apple, Regel 4.2 (Mindestfunktionalität):** Eine Hülle um eine Webseite wird oft abgelehnt. Dagegen helfen die echten App-Funktionen: Push, Vibration, Teilen, Zurück-Taste, Links. Diese vor der Einreichung auf einem echten Gerät zeigen, und in den Review-Hinweisen nennen.
- **Apple, Regel 1.2 (nutzergenerierte Inhalte):** Melden, Blockieren und Nutzungsbedingungen sind vorhanden. Eine Kontaktadresse für Support muss in den Store-Angaben stehen.
- **Apple, Regel 5.1.1(v):** Konto löschen in der App ist vorhanden (Einstellungen).
- **Apple, Regel 4.8:** Wer anderswo „Mit Google/X anmelden“ anbietet, muss auch „Mit Apple anmelden“ anbieten. Beim Start nur E-Mail + Passwort nutzen oder Apple-Anmeldung ergänzen.
- **Altersfreigabe:** 17+ (Apple) und „Dating“-Angaben in Google Play, weil Menschen sich treffen. 18+-Bestätigung ist in der App.
- **Datenschutz-Angaben** („App Privacy“, „Data safety“): Konto (Name, E-Mail), Standort, Fotos, Nachrichten, Geräte-ID für Mitteilungen. Kein Tracking, keine Werbung.
- **Google Play:** Neue Entwickler-Konten müssen vor der Veröffentlichung mit mindestens 12 Testern 14 Tage testen. Das früh planen.

## Grenzen
- Die App braucht Internet; offline gibt es nur die Fehlerseite (der Chat und der Feed kommen vom Server).
- Weg zu Gerätefunktionen weiter ausbauen: Kamera/Fotos laufen über die Datei-Auswahl der Seite, das reicht für Profil- und Chatbilder.
- Ein Bildschirm-Aufnahme-Test auf beiden Systemen, Dunkelmodus, Tastatur, Notch und Home-Indikator sind noch nicht auf echten Geräten geprüft.
