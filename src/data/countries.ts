export type Continent = 'Europa' | 'Azja' | 'Afryka' | 'Ameryka Północna' | 'Ameryka Południowa' | 'Oceania';

export const COUNTRY_CONTINENTS: Record<string, Continent> = {
  'Afganistan':'Azja','Albania':'Europa','Algieria':'Afryka','Andora':'Europa','Anglia':'Europa','Angola':'Afryka','Antigua i Barbuda':'Ameryka Północna','Arabia Saudyjska':'Azja','Argentyna':'Ameryka Południowa','Armenia':'Azja','Australia':'Oceania','Austria':'Europa','Azerbejdżan':'Azja',
  'Bahamy':'Ameryka Północna','Bahrajn':'Azja','Bangladesz':'Azja','Barbados':'Ameryka Północna','Belgia':'Europa','Belize':'Ameryka Północna','Benin':'Afryka','Bhutan':'Azja','Białoruś':'Europa','Boliwia':'Ameryka Południowa','Bośnia i Hercegowina':'Europa','Botswana':'Afryka','Brazylia':'Ameryka Południowa','Brunei':'Azja','Bułgaria':'Europa','Burkina Faso':'Afryka','Burundi':'Afryka',
  'Chile':'Ameryka Południowa','Chiny':'Azja','Chorwacja':'Europa','Cypr':'Europa','Czad':'Afryka','Czarnogóra':'Europa','Czechy':'Europa',
  'Dania':'Europa','Demokratyczna Republika Konga':'Afryka','Dominika':'Ameryka Północna','Dominikana':'Ameryka Północna','Dżibuti':'Afryka',
  'Egipt':'Afryka','Ekwador':'Ameryka Południowa','Erytrea':'Afryka','Estonia':'Europa','Eswatini':'Afryka','Etiopia':'Afryka',
  'Fidżi':'Oceania','Filipiny':'Azja','Finlandia':'Europa','Francja':'Europa',
  'Gabon':'Afryka','Gambia':'Afryka','Ghana':'Afryka','Grecja':'Europa','Grenada':'Ameryka Północna','Gruzja':'Azja','Gujana':'Ameryka Południowa','Gwatemala':'Ameryka Północna','Gwinea':'Afryka','Gwinea Bissau':'Afryka',
  'Haiti':'Ameryka Północna','Hiszpania':'Europa','Holandia':'Europa','Honduras':'Ameryka Północna',
  'Indie':'Azja','Indonezja':'Azja','Irak':'Azja','Iran':'Azja','Irlandia':'Europa','Islandia':'Europa','Izrael':'Azja',
  'Jamajka':'Ameryka Północna','Japonia':'Azja','Jemen':'Azja','Jordania':'Azja',
  'Kambodża':'Azja','Kamerun':'Afryka','Kanada':'Ameryka Północna','Katar':'Azja','Kazachstan':'Azja','Kenia':'Afryka','Kirgistan':'Azja','Kiribati':'Oceania','Kolumbia':'Ameryka Południowa','Komory':'Afryka','Kongo':'Afryka','Korea Południowa':'Azja','Korea Północna':'Azja','Kostaryka':'Ameryka Północna','Kuba':'Ameryka Północna','Kuwejt':'Azja',
  'Laos':'Azja','Lesotho':'Afryka','Liban':'Azja','Liberia':'Afryka','Libia':'Afryka','Liechtenstein':'Europa','Litwa':'Europa','Luksemburg':'Europa','Łotwa':'Europa',
  'Macedonia Północna':'Europa','Madagaskar':'Afryka','Malawi':'Afryka','Malediwy':'Azja','Malezja':'Azja','Mali':'Afryka','Malta':'Europa','Maroko':'Afryka','Mauretania':'Afryka','Mauritius':'Afryka','Meksyk':'Ameryka Północna','Mikronezja':'Oceania','Mjanma':'Azja','Mołdawia':'Europa','Monako':'Europa','Mongolia':'Azja','Mozambik':'Afryka',
  'Namibia':'Afryka','Nauru':'Oceania','Nepal':'Azja','Niemcy':'Europa','Niger':'Afryka','Nigeria':'Afryka','Nikaragua':'Ameryka Północna','Norwegia':'Europa','Nowa Zelandia':'Oceania',
  'Oman':'Azja',
  'Pakistan':'Azja','Palau':'Oceania','Panama':'Ameryka Północna','Papua-Nowa Gwinea':'Oceania','Paragwaj':'Ameryka Południowa','Peru':'Ameryka Południowa','Polska':'Europa','Portoryko':'Ameryka Północna','Portugalia':'Europa',
  'Republika Południowej Afryki':'Afryka','Republika Środkowoafrykańska':'Afryka','Rosja':'Europa','Ruanda':'Afryka','Rumunia':'Europa',
  'Saint Kitts i Nevis':'Ameryka Północna','Saint Lucia':'Ameryka Północna','Saint Vincent i Grenadyny':'Ameryka Północna','Salwador':'Ameryka Północna','Samoa':'Oceania','San Marino':'Europa','Senegal':'Afryka','Serbia':'Europa','Seszele':'Afryka','Sierra Leone':'Afryka','Singapur':'Azja','Słowacja':'Europa','Słowenia':'Europa','Somalia':'Afryka','Sri Lanka':'Azja','Stany Zjednoczone':'Ameryka Północna','Sudan':'Afryka','Sudan Południowy':'Afryka','Surinam':'Ameryka Południowa','Syria':'Azja','Szwajcaria':'Europa','Szwecja':'Europa',
  'Tadżykistan':'Azja','Tajlandia':'Azja','Tanzania':'Afryka','Timor Wschodni':'Azja','Togo':'Afryka','Tonga':'Oceania','Trynidad i Tobago':'Ameryka Północna','Tunezja':'Afryka','Turcja':'Europa','Turkmenistan':'Azja','Tuvalu':'Oceania',
  'Uganda':'Afryka','Ukraina':'Europa','Urugwaj':'Ameryka Południowa','Uzbekistan':'Azja',
  'Vanuatu':'Oceania','Watykan':'Europa','Wenezuela':'Ameryka Południowa','Węgry':'Europa','Wielka Brytania':'Europa','Wietnam':'Azja','Włochy':'Europa','Wybrzeże Kości Słoniowej':'Afryka','Wyspy Marshalla':'Oceania','Wyspy Salomona':'Oceania',
  'Zambia':'Afryka','Zimbabwe':'Afryka','Zjednoczone Emiraty Arabskie':'Azja',
};

export const COUNTRIES = Object.keys(COUNTRY_CONTINENTS).sort((a, b) => a.localeCompare(b, 'pl'));
