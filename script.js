document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = document.getElementById('heroDots');
  let currentSlide = 0;
  let slideTimer;

  const showSlide = (index) => {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === currentSlide));
    document.querySelectorAll('.hero-dot').forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === currentSlide));
  };

  const restartCarousel = () => {
    clearInterval(slideTimer);
    slideTimer = setInterval(() => showSlide(currentSlide + 1), 6000);
  };

  if (slides.length && dots) {
    slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = 'hero-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show slide ${index + 1}`);
      dot.addEventListener('click', () => { showSlide(index); restartCarousel(); });
      dots.appendChild(dot);
    });
    document.getElementById('prevSlide').addEventListener('click', () => { showSlide(currentSlide - 1); restartCarousel(); });
    document.getElementById('nextSlide').addEventListener('click', () => { showSlide(currentSlide + 1); restartCarousel(); });
    showSlide(0);
    restartCarousel();
  }

  hamburger?.addEventListener('click', () => {
    navbar.classList.toggle('nav-open');
    hamburger.setAttribute('aria-label', navbar.classList.contains('nav-open') ? 'Close menu' : 'Open menu');
  });
  document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => navbar.classList.remove('nav-open')));

  const setMessage = (id, message) => { const element = document.getElementById(id); if (element) element.textContent = message; };
  const submitToFirebase = async (payload, messageId, successMessage) => {
    try {
      await firebaseDb.collection('submissions').add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      setMessage(messageId, successMessage);
      return true;
    } catch (error) {
      setMessage(messageId, error.message || 'Unable to submit the form.');
      return false;
    }
  };
  document.getElementById('searchForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const destination = document.getElementById('searchDestination').value;
    setMessage('searchResult', destination ? `Great choice. Showing trips for ${destination}.` : 'Please choose a destination to search.');
  });
  document.getElementById('newsletterForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('newsletterEmail').value.trim();
    if (!email.includes('@')) return setMessage('newsletterMessage', 'Please enter a valid email address.');
    await submitToFirebase({ type: 'newsletter', email }, 'newsletterMessage', 'Thanks. Travel inspiration is on its way.');
  });
  document.getElementById('contactForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      type: 'contact',
      name: document.getElementById('contactName').value,
      email: document.getElementById('contactEmail').value,
      phone: document.getElementById('contactPhone').value,
      destination: document.getElementById('contactDestination').value,
      message: document.getElementById('contactMessage').value
    };
    await submitToFirebase(payload, 'contactMessageResult', 'Thank you. Our travel team will contact you soon.');
  });

  const packageDetails = {
    maldives: ['Maldives Escape', 'A relaxing island stay with a guided tour, breakfast and airport transfers.'],
    dubai: ['Dubai Explorer', 'See the city skyline, explore the desert and enjoy a comfortable hotel stay.'],
    kerala: ['Kerala Serenity', 'Slow down with a houseboat experience, sightseeing and peaceful backwater views.'],
    goa: ['Goa Getaway', 'Enjoy beaches, local sights and a flexible coastal escape.'],
    bali: ['Bali Adventure', 'Discover temples, tropical landscapes and memorable island activities.'],
    switzerland: ['Switzerland Dream Tour', 'Experience alpine scenery, scenic trains and charming mountain towns.']
  };
  const modal = document.getElementById('packageModal');
  const modalContent = document.getElementById('modalContent');
  const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
  document.querySelectorAll('.view-details').forEach((button) => button.addEventListener('click', () => {
    const detail = packageDetails[button.dataset.package];
    if (!detail) return;
    modalContent.innerHTML = `<h2>${detail[0]}</h2><p>${detail[1]}</p><a class="btn btn-primary" href="#contact">Plan this trip</a>`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }));
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', closeModal);

  const offerEnd = Date.now() + 5 * 24 * 60 * 60 * 1000;
  const updateCountdown = () => {
    const remaining = Math.max(0, offerEnd - Date.now());
    const values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
    ['countDays', 'countHours', 'countMinutes', 'countSeconds'].forEach((id, index) => { document.getElementById(id).textContent = String(values[index]).padStart(2, '0'); });
  };
  updateCountdown();
  setInterval(updateCountdown, 1000);

  const backToTop = document.getElementById('backToTop');
  window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 500));
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('revealed')), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
});
