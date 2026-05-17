// --- Scroll-Driven Experience (High Performance) ---
function initScrollExperience() {
  const container = document.querySelector('.scroll-experience');
  if (!container) return;

  const scenes = container.querySelectorAll('.scene');
  const progressDots = document.querySelectorAll('.progress-dot');
  const progressBar = document.getElementById('scrollProgress');
  const scrollHint = document.getElementById('scrollHint');
  const numScenes = scenes.length;

  if (numScenes === 0) return;

  let currentScene = 0;
  let ticking = false;

  // Cache dimensions to completely eliminate layout thrashing
  let containerOffsetTop = 0;
  let containerHeight = 0;
  let scrollableDistance = 0;

  function measure() {
    containerOffsetTop = container.offsetTop;
    containerHeight = container.offsetHeight;
    scrollableDistance = containerHeight - window.innerHeight;
  }

  // Initial measurement calculation
  measure();
  
  // Re-measure structure only when window changes dimensions
  window.addEventListener('resize', measure);

  function update() {
    const scrollY = window.scrollY;
    const relativeScroll = scrollY - containerOffsetTop;

    if (scrollableDistance <= 0) { 
      ticking = false; 
      return; 
    }

    // Normalized progress tracker from 0 to 1
    const progress = Math.max(0, Math.min(1, relativeScroll / scrollableDistance));
    
    // Smoothly calculate discrete steps across progress
    let newScene = Math.floor(progress * numScenes);
    if (newScene >= numScenes) newScene = numScenes - 1;

    if (newScene !== currentScene) {
      scenes[currentScene].classList.remove('active');
      scenes[newScene].classList.add('active');
      currentScene = newScene;
    }

    progressDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentScene);
    });

    // Make side progress bar visible when user is inside the section boundaries
    const buffer = 50; 
    const isInView = scrollY >= (containerOffsetTop - buffer) && scrollY <= (containerOffsetTop + scrollableDistance + buffer);
    if (progressBar) {
      progressBar.classList.toggle('visible', isInView);
    }

    if (scrollHint) {
      scrollHint.style.opacity = Math.max(0, 1 - scrollY / 300);
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  // Handle progress dot click scroll mapping targets accurately
  progressDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      measure(); 
      const segmentSize = 1 / numScenes;
      const targetProgressMidpoint = (i * segmentSize) + (segmentSize / 2);
      const targetScroll = containerOffsetTop + (targetProgressMidpoint * scrollableDistance);

      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  update();
}



// --- Navbar scroll effect ---
function initNavbar() {
  const navbar = document.getElementById('navbar');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });
}

// --- Mobile menu toggle ---
function initMobileMenu() {
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const spans = mobileToggle.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      const spans = mobileToggle.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    });
  });
}

// --- Contact form (Updated for Netlify AJAX Processing) ---
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Keep page from hard-refreshing
    
    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    
    // Prevent immediate multiple submissions & give a visual cue
    btn.disabled = true;
    btn.textContent = 'Sending...';

    // Package the form parameters inside an array Netlify expects
    const formData = new FormData(contactForm);

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(formData).toString()
    })
    .then((response) => {
      if (response.ok) {
        // Success animation triggers if Netlify server saves it cleanly
        btn.textContent = 'Message Sent ✓';
        btn.style.background = '#2ecc71';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
          contactForm.reset();
        }, 3000);
      } else {
        throw new Error('Network error processing application response.');
      }
    })
    .catch((error) => {
      console.error('Form submission error:', error);
      
      // Error handling UI layout change
      btn.textContent = 'Error! Try Again';
      btn.style.background = '#e74c3c';
      btn.disabled = false;
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 3000);
    });
  });
}

// --- Smooth scroll for anchor links ---
function initSmoothScroll() {
  const navbar = document.getElementById('navbar');

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetSelector = anchor.getAttribute('href');
      if (targetSelector === '#') return;
      const target = document.querySelector(targetSelector);
      if (target) {
        e.preventDefault();
        const navHeight = navbar ? navbar.offsetHeight : 0;
        const targetPosition = target.offsetTop - navHeight - 20;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initScrollExperience();
  initNavbar();
  initMobileMenu();
  initContactForm();
  initSmoothScroll();
});
