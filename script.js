function initScrollExperience() {
  const container = document.querySelector('.scroll-experience');
  if (!container) return;

  const scenes = container.querySelectorAll('.scene');
  const progressDots = document.querySelectorAll('.progress-dot');
  const progressBar = document.getElementById('scrollProgress');
  const scrollHint = document.getElementById('scrollHint');

  // Handle Scroll Hint fade out smoothly without heavy math
  window.addEventListener('scroll', () => {
    if (scrollHint) {
      scrollHint.style.opacity = window.scrollY > 150 ? '0' : '1';
    }
  }, { passive: true });

  // Use IntersectionObserver to track which scene is active natively
  const observerOptions = {
    root: null, // viewport
    rootMargin: '-20% 0px -20% 0px', // Trigger slightly before it hits center stage
    threshold: 0.2 // Trigger when 20% of the scene is intersecting
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const targetScene = entry.target;
        const sceneIndex = parseInt(targetScene.getAttribute('data-scene'), 10);

        // Remove active class from all other scenes and dots
        scenes.forEach(s => s.classList.remove('active'));
        progressDots.forEach(d => d.classList.remove('active'));

        // Activate current scene and its progress dot
        targetScene.classList.add('active');
        if (progressDots[sceneIndex]) {
          progressDots[sceneIndex].classList.add('active');
        }
      }
    });
  }, observerOptions);

  // Attach observer to each scene
  scenes.forEach(scene => observer.observe(scene));

  // Toggle vertical progress indicator bar visibility using container intersection
  const containerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (progressBar) {
        progressBar.classList.toggle('visible', entry.isIntersecting);
      }
    });
  }, { rootMargin: '-50% 0px -50% 0px' });

  containerObserver.observe(container);

  // Progressive dot smooth scrolling behavior
  progressDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (scenes[i]) {
        scenes[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
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
