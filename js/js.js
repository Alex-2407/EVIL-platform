// Carica header e footer centralizzati dalle components HTML
(async function loadShellComponents(){
	try {
		async function tryFetchText(paths){
			for (const p of paths){
				try {
					const r = await fetch(p, {cache: 'no-store'});
					if (r.ok) return await r.text();
				} catch(e) {
					// ignore and try next
				}
			}
			return null;
		}

		// candidate paths to support file://, different hosting roots, and relative locations
		const headerCandidates = [
			'./components/header.html',
			'components/header.html',
			'../html/components/header.html',
			'./html/components/header.html',
			'/html/components/header.html'
		];

		const footerCandidates = [
			'./components/footer.html',
			'components/footer.html',
			'../html/components/footer.html',
			'./html/components/footer.html',
			'/html/components/footer.html'
		];

		// Carica header
		try {
			const headerHTML = await tryFetchText(headerCandidates);
			if (headerHTML) {
				const existingHeader = document.querySelector('header');
				if (existingHeader) existingHeader.outerHTML = headerHTML;
				else document.body.insertAdjacentHTML('afterbegin', headerHTML);

				// init basic listeners
				const hamburgerBtn = document.querySelector('.hamburger-btn');
				const nav = document.querySelector('nav');
				if (hamburgerBtn && nav) {
					hamburgerBtn.addEventListener('click', () => {
						hamburgerBtn.classList.toggle('active');
						nav.classList.toggle('active');
					});
				}
			}
		} catch (e) {
			console.warn('[shell] header non disponibile:', e && e.message ? e.message : e);
		}

		// Carica footer
		try {
			const footerHTML = await tryFetchText(footerCandidates);
			if (footerHTML) {
				const existingFooter = document.querySelector('footer');
				if (existingFooter) existingFooter.outerHTML = footerHTML;
				else document.body.insertAdjacentHTML('beforeend', footerHTML);
			}
		} catch (e) {
			console.warn('[shell] footer non disponibile:', e && e.message ? e.message : e);
		}

		// Ensure footer is visible (some pages set footer opacity:0 by default)
		try {
			const finalFooter = document.querySelector('footer');
			if (finalFooter) {
				finalFooter.classList.add('visible');
				finalFooter.style.opacity = '1';
			}
		} catch (e) {
			// ignore
		}

	} catch (err) {
		console.error('[shell] errore caricamento componenti:', err);
	}
})();

