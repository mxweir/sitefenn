# SiteFenn 2.9 · Pilotprotokoll v1

Dieses Protokoll gilt für den GitHub-Tag `v2.9.0-rc.1`. Vor der ersten externen Sitzung den Release-Commit und die SHA-256 des tatsächlich verwendeten Pakets im Sitzungsbogen festhalten. Änderungen an Aufgaben oder Schwellen vor der ersten Sitzung als neue Protokollversion kennzeichnen. Daten aus unterschiedlichen Versionen getrennt auswerten.

## Teilnehmende und Projekte

- Mindestens fünf externe Personen, die Websites betreuen oder entwickeln und an der Implementierung nicht beteiligt waren. Mindestens fünf und höchstens acht ausdrücklich freigegebene Projekte mit unterschiedlichen Vorlagen oder Zuständen. Je Projekt Eigentümerfreigabe und die konkreten erlaubten URLs und Zustände privat dokumentieren.
- Lokales Web/CLI-Paket, eigener Pilot-Workspace, geeignete autorisierte Kopie oder Staging. Einen reparierbaren gemessenen Befund mit vorab bekannter erwarteter Korrektur vorbereiten. Keine Produktivänderungen als Voraussetzung. Synthetische Übungsseiten bleiben in der separaten internen Probe.
- Für die Kernaufgaben ein einheitliches Profil, kein Modell und keine Google-Verbindung verwenden. Je Sitzung Plattform, Browser, Zoom, Eingabemethode, Profil und eventuelle Abweichungen erfassen. Der Pilot-Workspace und seine Exporte bleiben lokal. Einverständnis zur Teilnahme und zu den vereinbarten Notizen separat einholen. Keine Aufzeichnung oder öffentliche Weitergabe ohne Einverständnis.

## Aufgabenkarte für Teilnehmende

1. **Befund verstehen.** Finde den vorgegebenen Befund im vorbereiteten Projekt. Zeige die Originalfundstelle und erkläre, was tatsächlich gemessen wurde, auf welcher URL, auf welchem Gerät und in welchem Zustand.
2. **Arbeit übergeben.** Erstelle ein lokales Markdown-Arbeitspaket, das nur diesen Befund enthält. Zeige darin den erlaubten Umfang und den Abnahmetest. Es ist kein Quellzugriff für diese Aufgabe erforderlich.
3. **Fix nachtesten und wiederfinden.** Teste dieselbe Aufgabe einmal vor und einmal nach der vorbereiteten Änderung. Zeige den unterschiedlichen Status. Lade SiteFenn neu und finde die ursprüngliche Aufgabe und den bestätigenden Nachtest wieder.

Die Aufgabenkarte nennt Ziele und keine Menüpfade. Änderungen finden nur in der freigegebenen Kopie statt. Die Moderation stellt für Aufgabe 3 beide Quellstände in vereinbarter Reihenfolge bereit, gibt aber keine UI-Hinweise. In der synthetischen Probe ersetzt die Moderation den Kommentar im HTML-Kopf durch ein aussagekräftiges `<title>`-Element.

## Bewertung und Freigaberegel

| Aufgabe | Erfolg ohne Hilfe | Zeitlimit |
| --- | --- | ---: |
| A · Verstehen | Korrekte Fundstelle mit Originalbeleg, URL, Gerät, Zustand und gemessener Aussage | 8 min |
| B · Übergeben | Genau der ausgewählte Befund, zulässiger Umfang und reproduzierbarer Abnahmetest im heruntergeladenen Markdown | 8 min |
| C · Nachtesten | Unveränderter Befund bleibt offen. Korrigierter Quellstand ergibt einen passenden Nachtest. Originalaufgabe und verlinkter Nachtest sind nach Neuladen erreichbar | 12 min |

Je Aufgabe mindestens 80 Prozent selbstständige Erfolge und mindestens fünf gültige gestartete Sitzungen. Bei fünf Teilnehmenden sind das vier Erfolge je Aufgabe. Hilfe, Zeitablauf und Abbruch zählen als nicht selbstständig erfolgreich. Wird eine Aufgabe wegen eines vorherigen Abbruchs nicht erreicht, zählt sie im selben geplanten Durchlauf als nicht erfolgreich. Technische Unterbrechungen separat mit Grund ausweisen. Alle begonnenen Fälle bleiben sichtbar.

Eine falsche Verifizierung oder kritischer Datenverlust blockiert die Freigabe. Einen mutmaßlichen Fehlalarm einzeln am Originalbeleg, Regelprotokoll und tatsächlichen Quellstand nachprüfen. Kritische und schwere Fehler zuerst behandeln, mit reproduzierbaren Schritten und Nachtest dokumentieren. Einen getrennten Tastatur-, 200-Prozent-Zoom- und vollständigen VoiceOver-Durchgang mit den drei Aufgaben führen. Weitere Browser-/Assistenzkombinationen separat kennzeichnen.

## Lokaler Sitzungsbogen

Je Teilnehmercode einen privaten Bogen ausfüllen. Nur zusammengefasste oder ausdrücklich zur Veröffentlichung freigegebene, redigierte Daten veröffentlichen.

| Feld | Eintrag |
| --- | --- |
| Teilnehmercode und Rolle | |
| Projektcode, freigegebener Umfang separat dokumentiert | |
| Release-Commit und Paket-SHA-256 | |
| Plattform, Browser, Zoom, Eingabemethode | |
| A · Zeit, Erfolg, Hilfe, Abbruch, Beobachtung | |
| B · Zeit, Erfolg, Hilfe, Abbruch, Beobachtung | |
| C · Zeit, Erfolg, Hilfe, Abbruch, Beobachtung | |
| Erwarteter / beobachteter Status und Nachtestbeleg | |
| Fehlalarm oder falsche Verifizierung · private Belegreferenz und Nachprüfung | |
| Datenverlust, Schweregrad, Reproduktion, Folgetest | |

## Synthetische interne Probe starten

Im entpackten und eingerichteten Paket einen separaten Workspace starten. Einen zweiten Terminal-Tab für die Übungsseite verwenden.

```sh
HUB_DATA_DIR=/absolute/path/new-pilot-workspace PORT=4328 node scripts/launch.mjs
node --import tsx scripts/pilot-fixture.ts /absolute/path/new-pilot-fixture
```

Die ausgegebene URL als lokales Projekt hinzufügen und mit dem Mobilprofil prüfen. Der Titel fehlt in der Ausgangsfassung. Die Übungsseite liest bei jeder Anfrage dieselbe lokale `index.html` neu ein. Der Browsernachtest bleibt dadurch auf derselben URL. [Prüfstand des Release-Kandidaten](RELEASE-2.9.md).
