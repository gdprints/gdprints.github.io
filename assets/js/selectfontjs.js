

 document.addEventListener("DOMContentLoaded", function () {
            const fonts = [
       "Sylfaen", "Arial Armenian","ArTarumianMHarvats", "Noto Sans Armenian", "Noto Serif Armenian",
                "FreeSerif", "DejaVu Sans", "Arial Unicode MS", "Verdana", "Tahoma",
                "Times New Roman", "Segoe UI", "Roboto", "Open Sans", "Lato", "Raleway",
                "Ubuntu", "Fira Sans", "PT Sans", "Merriweather", "Cousine", "Droid Serif",
                "Manjari", "Tinos", "Mukta", "Hind Madurai", "Bona Nova", "Scheherazade",
                "Inter", "Assistant", "Titillium Web", "IBM Plex Sans", "Work Sans",
                "Space Grotesk", "Oxygen", "Barlow", "Josefin Sans", "Chivo", "Poppins",
                "Bree Serif", "Cabin", "Exo", "Varela Round", "Quicksand", "Asap", "Karla",
                "Nunito", "Source Sans Pro", "Zilla Slab", "Playfair Display", "Slabo 27px",
                "Arvo", "Cormorant", "Archivo", "Ropa Sans", "Red Hat Display", "Mulish",
                "Cormorant Garamond", "Spectral", "Didact Gothic", "EB Garamond",
                "Overpass", "Maven Pro", "Lexend", "Anton", "Fjalla One", "Oswald",
                "Jost", "Heebo", "Domine", "Palanquin", "M PLUS Rounded 1c",
                "Sen", "Jaldi", "Yatra One", "Rakkas", "Bitter", "Alata", "Ysabeau",
                "Aleo", "Urbanist", "Saira", "Gelasio", "Rasa", "Padauk", "Trirong",
                "Noto Kufi Arabic", "Padyakke", "Changa", "Tajawal", "Amiri",
                "Noto Naskh Arabic", "Reem Kufi", "Baloo Bhaina 2", "Baloo Da 2",
                "Baloo Bhaijaan 2", "Aref Ruqaa", "Scheherazade New", "Mirza",
                "Markazi Text", "Almarai", "Harmattan", "Lateef", "El Messiri",
                "Changa One", "Alegreya Sans", "Didot", "Courier New", "Geneva",
                "Helvetica", "Palatino", "Perpetua", "Garamond", "Franklin Gothic",
                "Bodoni MT", "Baskerville", "Lucida Console", "Trebuchet MS",
                "Candara", "Calibri", "Constantia", "Corbel", "Century Gothic"
            ];
            
            // Ստանում ենք բոլոր dropdown-ները
            const fontSelectors = document.querySelectorAll(".fontSelect");

            fontSelectors.forEach(select => {
                fonts.forEach(font => {
                    let option = document.createElement("option");
                    option.value = font;
                    option.textContent = font;
                    option.style.fontFamily = font; // Հնարավոր դարձնել ճիշտ տեսքը
                    select.appendChild(option);
                });

                // Dropdown-ի փոփոխման ժամանակ փոխել նաև ընտրած տառատեսակը
                select.addEventListener("change", function () {
                    select.style.fontFamily = this.value;
                });
            });

        });
