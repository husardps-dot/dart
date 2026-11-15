# Dart – licznik punktów: instalacja na tablecie

To jest aplikacja webowa instalowana z przeglądarki (PWA). Po zainstalowaniu:
- ma ikonę na ekranie głównym i otwiera się na pełnym ekranie, bez paska przeglądarki,
- **działa bez internetu**,
- trzyma ranking i statystyki w **lokalnej bazie danych tabletu** (IndexedDB), a nie na żadnym serwerze.

Internet jest potrzebny tylko raz, żeby ją zainstalować.

## Dlaczego trzeba ją raz wrzucić do internetu

Przeglądarka pozwala zainstalować aplikację tylko ze strony z adresem `https://`.
Pliku otwartego prosto z pamięci tabletu nie da się zainstalować.
Wystarczy darmowy hosting plików. Po instalacji tablet już z niego nie korzysta.

### Sposób A: Netlify Drop (najszybszy, ok. 2 minuty)
1. Na komputerze rozpakuj ZIP.
2. Wejdź na https://app.netlify.com/drop i przeciągnij **cały folder** `dart` na stronę.
3. Załóż darmowe konto, gdy strona o to poprosi. Bez konta stronę skasują po godzinie.
4. Dostaniesz adres w stylu `https://jakas-nazwa.netlify.app`. Nazwę zmienisz w *Site settings*.

### Sposób B: GitHub Pages (darmowy i na zawsze)
1. Załóż konto na github.com i utwórz nowe, publiczne repozytorium, np. `dart`.
2. *Add file → Upload files*: wrzuć **zawartość** folderu, tak żeby `index.html` był na samej górze repozytorium.
3. *Settings → Pages → Branch: main / (root) → Save*.
4. Po minucie aplikacja będzie pod adresem `https://TWOJ-LOGIN.github.io/dart/`.

## Instalacja na tablecie

**Android (Chrome):** otwórz adres → menu **⋮** → **Zainstaluj aplikację** albo **Dodaj do ekranu głównego**.
**iPad (Safari):** otwórz adres → **Udostępnij** → **Do ekranu początkowego**.

Potem uruchom aplikację raz przy włączonym internecie. Od tej chwili internet nie jest potrzebny.

## Tablet na ścianie: ustawienia warte zmiany
- **Ekran ma się nie wygaszać.** Aplikacja sama o to prosi (Wake Lock), ale starsze tablety tego nie obsługują. Wtedy w ustawieniach Androida ustaw *Wyświetlacz → Wygaszanie ekranu* na najdłuższy czas albo włącz *Opcje programisty → Pozostaw włączony podczas ładowania*.
- **Blokada na jednej aplikacji:** *Ustawienia → Zabezpieczenia → Przypinanie aplikacji* (na niektórych tabletach „Przypnij ekran”). Nikt wtedy niechcący nie wyjdzie z aplikacji.
- **Ładowarka podłączona na stałe.** Jeśli tablet ma tryb ochrony baterii (np. ładowanie do 85%), warto go włączyć.

## Twoje dane
- Statystyki są tylko na tym tablecie. **Raz na jakiś czas** zrób kopię: *Ranking → Kopia zapasowa → Zapisz kopię do pliku*. Plik `.json` trafi do folderu *Pobrane*.
- Kopię da się wczytać na innym urządzeniu: *Wczytaj kopię z pliku*. Legi, których jeszcze nie ma, zostaną dopisane do obecnych, a te same legi się nie zdublują.
- **Nie czyść danych przeglądarki** ani danych aplikacji w ustawieniach Androida, bo to usunie ranking.
- Odinstalowanie aplikacji z ekranu głównego może usunąć jej dane. Najpierw zrób kopię.

## Aktualizacje
Jeśli podmienisz pliki na hostingu, tablet pobierze nową wersję przy następnym uruchomieniu z internetem.
Statystyki zostają, bo są w bazie tabletu, a nie w plikach aplikacji.

## Wymagania
Android 7 lub nowszy z w miarę aktualnym Chrome albo iPad z iPadOS 13 lub nowszym.
Na bardzo starym tablecie zaktualizuj najpierw *Chrome* i *Android System WebView* w Sklepie Play.

Czcionki: Anton SC i Inter (SIL Open Font License, licencje w folderze `fonts`).
