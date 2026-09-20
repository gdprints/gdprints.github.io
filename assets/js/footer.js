// footer.js
document.addEventListener("DOMContentLoaded", function () {
  const footerHTML = `
    <footer id="footer" class="footer position-relative dark-background">



		<div class="container footer-top">
			<div class="row gy-3">
				<div class="col-lg-3 col-md-6 footer-about">
					<a href="home.html" class="d-flex align-items-center">
						<span class="sitename"><img style="width: 158px;" src="assets/img/logo.png" alt=""> </span>
					</a>
					<div class="footer-contact pt-3">
						<p id="adres">Կենտրոնական Խճուղի 45</p>
						<p id="adres2">Կոտայքի Մարզ Գյուղ Ակունք</p>
						<p id="tel" class="mt-3"><strong>Հեռ:</strong> <span><a style="font-family: sans-serif; font-weight: 500; font-size: 14px;" href="tel:+37496965874">+37496965874</a></span></p>
						<p id="maill"><strong>Էլ Հասցե:</strong> <span>golden.design01@mail.ru</span></p>
					</div>
				</div>

				<div class="col-lg-3 col-md-6 footer-links">
					<h4 id="uslink">Օգտակար հղումներ</h4>
					<ul>
						<li><i class="bi bi-chevron-right"></i> <a id="fhome" href="home.html">Տուն</a></li>
						<li><i class="bi bi-chevron-right"></i> <a id="fabout" href="about.html">Մեր մասին</a></li>
						<li><i class="bi bi-chevron-right"></i> <a id="fservic" href="services.html">Ծառայություն</a></li>
						<li><i class="bi bi-chevron-right"></i> <a id="TS" style="line-height: 20px;" href="index.html">Ծառայության պայմանները</a></li>
					</ul>
				</div>

				<div class="col-lg-3 col-md-6 footer-links">
					<h4 id="serv">Ծառայությունները</h4>
					<ul>
						<li><i class="bi bi-chevron-right"></i> <a id="plt" href="services.html">Պլոտերային Հատում</a></li>
						<li><i class="bi bi-chevron-right"></i> <a id="larg" href="services.html">Լայնաֆորմատ տպագրություն</a></li>
						<li><i class="bi bi-chevron-right"></i> <a id="photo" href="services.html">Լուսանկարների տպագրություն</a></li>
					</ul>
				</div>


				<div class="col-lg-3 col-md-12">
					<h4 id="media">Բաժանորդագրվեք որպեսզի առաջինը ստանաք նորություններ</h4>
				
 <!-- DEMO BUTTON - REMOVE THIS IN YOUR PROJECT -->
    <button id="gdpOpenModalBtn" style="background:red; color:white; border:none; padding:10px 15px; border-radius:5px; font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 10px 25px rgba(139,26,26,0.3);">
        <i class="fas fa-bell" style="margin-right:10px;"></i>
        Բաժանորդագրվել մեք
    </button>

    <!-- AUDIO ELEMENT (hidden) - YOU CAN CHANGE THE SRC -->
    <audio id="gdpSuccessAudio" class="gdp-audio-player" preload="auto">
        <source src="success-sound.mp3" type="audio/mpeg">
        <!-- If you don't have audio file, you can use online sound or remove -->
        <!-- <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg"> -->
    </audio>

    <!--========== MAIN MODAL ==========-->
    <div id="gdpSubscriptionModal" class="gdp-modal">
        <div class="gdp-modal__container">
            <!-- HEADER -->
            <div class="gdp-modal__header">
                <h2>Միացեք մեզ</h2>
                <p>Եղեք առաջինը, ով կիմանա նոր առաջարկների մասին</p>
                <div class="gdp-modal__badge">
                    <i class="fas fa-gem"></i> 10% զեղչ առաջին պատվերի համար
                </div>
                <button class="gdp-modal__close" id="gdpCloseModalBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- BODY -->
            <div class="gdp-modal__body">
                <!-- BENEFITS -->
                <div class="gdp-benefits">
                    <div class="gdp-benefit-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Բացառիկ զեղչեր միայն բաժանորդների համար</span>
                    </div>
                    <div class="gdp-benefit-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Շաբաթական տեղեկագիր նորություններով</span>
                    </div>
                    <div class="gdp-benefit-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Անվճար առաքում 50,000 դրամից ավելի պատվերների դեպքում</span>
                    </div>
                </div>

                <!-- SUBSCRIPTION FORM - FORMSUBMIT.CO INTEGRATION -->
                <form class="gdp-form" id="gdpSubscriptionForm" action="https://formsubmit.co/ՁԵՐ_ԷԼ_ՀԱՍՑԵՆ_ԱՅՍՏԵՂ" method="POST">
                    <!-- Honeypot spam protection -->
                    <input type="text" name="_honey" style="display:none">
                    <!-- Disable captcha (optional) -->
                    <input type="hidden" name="_captcha" value="false">
                    <!-- Success page (optional - redirect after submission) -->
                    <input type="hidden" name="_next" value="https://gdprint.github.io/success.html">
                    <!-- Include all form fields -->
                    <input type="hidden" name="_subject" value="Նոր բաժանորդագրություն կայքից">
                    
                    <!-- NAME FIELD -->
                    <div class="gdp-form-row">
                        <label for="gdpName">Անուն <span style="color:#ff4d4d;">*</span></label>
                        <div class="gdp-input-wrapper">
                            <i class="fas fa-user"></i>
                            <input type="text" id="gdpName" name="Անուն" placeholder="Օրինակ՝ Հայկ Ասատրյան" required>
                        </div>
                    </div>

                    <!-- EMAIL FIELD -->
                    <div class="gdp-form-row">
                        <label for="gdpEmail">Էլ. հասցե <span style="color:#ff4d4d;">*</span></label>
                        <div class="gdp-input-wrapper">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="gdpEmail" name="Էլ․ հասցե" placeholder="example@mail.com" required>
                        </div>
                    </div>

                    <!-- PHONE FIELD -->
                    <div class="gdp-form-row">
                        <label for="gdpPhone">Հեռախոսահամար</label>
                        <div class="gdp-input-wrapper">
                            <i class="fas fa-phone-alt"></i>
                            <input type="tel" id="gdpPhone" name="Հեռախոս" placeholder="+374 XX XXX XXX">
                        </div>
                        <div class="gdp-phone-hint">
                            <i class="fas fa-info-circle"></i> Ձեր համարն անհրաժեշտ է պատվերի կարգավիճակի մասին տեղեկացնելու համար
                        </div>
                    </div>

                    <!-- TERMS CHECKBOX -->
                    <div class="gdp-checkbox">
                        <input type="checkbox" id="gdpTerms" required>
                        <label for="gdpTerms">
                            Ընդունում եմ <a href="https://gdprint.github.io/services.html" target="_blank">օգտագործման պայմանները</a> և համաձայն եմ, որ իմ տվյալները մշակվեն
                        </label>
                    </div>

                    <!-- HIDDEN FIELDS FOR FORMSUBMIT -->
                    <input type="hidden" name="_template" value="box">
                    <input type="hidden" name="_autoresponse" value="Շնորհակալություն բաժանորդագրվելու համար։ Դուք ստացել եք 10% զեղչ Ձեր առաջիկա պատվերի համար։">

                    <!-- SUBMIT BUTTON -->
                    <button type="submit" class="gdp-submit-btn" id="gdpSubmitBtn">
                        <span>Բաժանորդագրվել</span>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </form>
            </div>

            <!-- FOOTER -->
            <div class="gdp-modal__footer">
                <div class="gdp-security">
                    <span><i class="fas fa-lock"></i> Անվտանգ է</span>
                    <span><i class="fas fa-shield-alt"></i> Գաղտնիություն</span>
                    <span><i class="fas fa-clock"></i> Չեղարկել ցանկացած պահի</span>
                </div>
            </div>
        </div>
    </div>

    <!-- TOAST NOTIFICATION (compact) -->
    <div id="gdpToast" class="gdp-toast">
        <i class="fas" id="gdpToastIcon"></i>
        <span id="gdpToastMessage"></span>
    </div>

				</div>


			</div>
		</div>

		<div class="container copyright text-center mt-4">
			<p id="copy">© <span>Հեղինակային իրավունք</span> <strong class="px-1 sitename">GDprinting</strong> <span>Բոլոր իրավունքները պաշտպանված են</span></p>
			<div id="designby" class="credits">
				Նախագծել է <a href="https://www.facebook.com/golden.design01">Հ. Չալիկյան </a>
			</div>
		</div>

	</footer>

  `;

  document.body.insertAdjacentHTML("beforeend", footerHTML);
});