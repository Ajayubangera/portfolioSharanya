/* ==========================================================================
   1. THREE.JS 3D CANVAS BACKGROUND
   ========================================================================== */

// Canvas & Scene Setup
const canvas = document.getElementById('webgl-canvas');
const container = document.getElementById('canvas-container');

if (canvas && container) {
  const scene = new THREE.Scene();
  
  // Camera Setup
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 7;
  
  // Renderer Setup
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights Setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x00e5ff, 3, 40);
  pointLight1.position.set(6, 6, 6);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xbd00ff, 3, 40);
  pointLight2.position.set(-6, -6, 6);
  scene.add(pointLight2);

  // Floating Starfield Background
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 1200;
  const starPositions = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount * 3; i++) {
    // Distribute randomly in space
    starPositions[i] = (Math.random() - 0.5) * 60;
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

  // Canvas texture generator for high performance round particles
  const createCircleTexture = () => {
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 16;
    starCanvas.height = 16;
    const ctx = starCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(starCanvas);
  };

  const starsMaterial = new THREE.PointsMaterial({
    size: 0.14,
    map: createCircleTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);

  // Hero Section Morphing Faceted Object
  const outerGeom = new THREE.IcosahedronGeometry(2.1, 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });
  const outerMesh = new THREE.Mesh(outerGeom, outerMat);
  scene.add(outerMesh);

  const innerGeom = new THREE.IcosahedronGeometry(1.7, 2);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xbd00ff,
    roughness: 0.08,
    metalness: 0.85,
    flatShading: true,
    transparent: true,
    opacity: 0.85
  });
  const innerMesh = new THREE.Mesh(innerGeom, innerMat);
  scene.add(innerMesh);

  // Backup positions to perform custom mesh morph calculations
  innerGeom.userData.originalPosition = innerGeom.attributes.position.clone();
  outerGeom.userData.originalPosition = outerGeom.attributes.position.clone();

  // Mouse Parallax Coefficients
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  
  // Scroll Percent Coefficient
  let scrollPercent = 0;

  window.addEventListener('mousemove', (e) => {
    // Normalize coordinates between -0.5 and 0.5
    targetX = (e.clientX / window.innerWidth) - 0.5;
    targetY = (e.clientY / window.innerHeight) - 0.5;
  });

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;
  });

  // Resize Handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation / Render loop
  const clock = new THREE.Clock();

  const tick = () => {
    const elapsedTime = clock.getElapsedTime();

    // 1. Mesh Morphing Ripples
    const morphPositions = (geom, multiplier = 1) => {
      const posAttr = geom.attributes.position;
      const original = geom.userData.originalPosition;
      
      for (let i = 0; i < posAttr.count; i++) {
        const vx = original.getX(i);
        const vy = original.getY(i);
        const vz = original.getZ(i);
        
        // Calculate ripples using spatial sine/cosine functions
        const ripple = Math.sin(vx * 2.5 + elapsedTime * 1.5) * 
                       Math.cos(vy * 2.5 + elapsedTime * 1.5) * 
                       0.12 * multiplier;
        
        posAttr.setXYZ(i, vx + vx * ripple, vy + vy * ripple, vz + vz * ripple);
      }
      
      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
    };

    morphPositions(innerGeom, 1);
    morphPositions(outerGeom, 0.8);

    // 2. Mesh Rotation
    outerMesh.rotation.y = elapsedTime * 0.08;
    outerMesh.rotation.x = elapsedTime * 0.04;
    innerMesh.rotation.y = -elapsedTime * 0.12;
    innerMesh.rotation.x = -elapsedTime * 0.06;

    // 3. Mouse Parallax (Lerped with Inertia)
    mouseX += (targetX - mouseX) * 0.05;
    mouseY += (targetY - mouseY) * 0.05;

    camera.position.x = mouseX * 3.5;
    camera.position.y = -mouseY * 3.5;
    
    // 4. Scroll Camera Sink Depth
    const baseZ = 7;
    const scrollZ = scrollPercent * -24; // Sink deeper into stars
    camera.position.z = baseZ + scrollZ;

    // Slide mesh upward and fade materials out as scroll advances past Hero
    const fadePivot = Math.max(0, 1 - scrollPercent * 2.8);
    outerMesh.position.y = -scrollPercent * 8;
    innerMesh.position.y = -scrollPercent * 8;
    
    outerMat.opacity = fadePivot * 0.22;
    innerMat.opacity = fadePivot * 0.85;

    // Look at center offset slightly by mouse
    camera.lookAt(new THREE.Vector3(0, -scrollPercent * 4, 0));

    // Render Scene
    renderer.render(scene, camera);

    // Loop
    requestAnimationFrame(tick);
  };

  tick();
}

/* ==========================================================================
   2. CUSTOM FLOATING CURSOR
   ========================================================================== */

const cursor = document.getElementById('custom-cursor');
const cursorDot = document.getElementById('custom-cursor-dot');
let cursorX = 0, cursorY = 0;
let targetCursorX = 0, targetCursorY = 0;

if (cursor && cursorDot) {
  window.addEventListener('mousemove', (e) => {
    targetCursorX = e.clientX;
    targetCursorY = e.clientY;
    
    // Set opacity on first interaction
    cursor.style.opacity = '1';
    cursorDot.style.opacity = '1';
  });

  // Smooth lerped frame updates
  const renderCursor = () => {
    cursorX += (targetCursorX - cursorX) * 0.12;
    cursorY += (targetCursorY - cursorY) * 0.12;
    
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    
    cursorDot.style.left = `${targetCursorX}px`;
    cursorDot.style.top = `${targetCursorY}px`;
    
    requestAnimationFrame(renderCursor);
  };
  renderCursor();

  // Attach hover animations to triggers
  const interactiveTriggers = document.querySelectorAll('a, button, input, textarea, .project-card, .menu-toggle');
  interactiveTriggers.forEach(element => {
    element.addEventListener('mouseenter', () => {
      cursor.style.width = '55px';
      cursor.style.height = '55px';
      cursor.style.borderColor = 'var(--accent-purple)';
      cursor.style.backgroundColor = 'rgba(189, 0, 255, 0.06)';
      cursor.style.boxShadow = 'var(--shadow-neon-purple)';
    });
    
    element.addEventListener('mouseleave', () => {
      cursor.style.width = '40px';
      cursor.style.height = '40px';
      cursor.style.borderColor = 'var(--accent-cyan)';
      cursor.style.backgroundColor = 'transparent';
      cursor.style.boxShadow = 'none';
    });
  });
}

/* ==========================================================================
   3. MOBILE NAVIGATION AND INTERACTIVE HEADER
   ========================================================================== */

const header = document.querySelector('.header');
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
const mobileLinks = document.querySelectorAll('.mobile-link');

// Scroll Shrink Header
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Toggle Mobile Menu
if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('open');
    mobileNav.classList.toggle('open');
    document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : 'auto';
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = 'auto';
    });
  });
}

/* ==========================================================================
   4. GSAP PAGE TRANSITIONS AND INTERSECT OBSERVERS
   ========================================================================== */

// Reveal Animations using lightweight intersection detection
const revealElements = document.querySelectorAll('.scroll-reveal');

if (revealElements.length > 0) {
  const revealOptions = {
    root: null,
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px'
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        gsap.to(entry.target, {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: 'power3.out',
          overwrite: 'auto'
        });
        observer.unobserve(entry.target);
      }
    });
  }, revealOptions);

  revealElements.forEach(element => {
    revealObserver.observe(element);
  });
}

// Active Nav Link Tracker on Scroll
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

if (sections.length > 0 && navLinks.length > 0) {
  const activeOptions = {
    root: null,
    threshold: 0.25,
    rootMargin: '-80px 0px -40% 0px'
  };

  const activeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, activeOptions);

  sections.forEach(section => {
    activeObserver.observe(section);
  });
}

/* ==========================================================================
   5. CONTACT FORM VALIDATION & INTERACTION
   ========================================================================== */

const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    // Check simple requirements
    if (!name || !email || !message) {
      showStatus('Please complete all form fields.', 'error');
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showStatus('Please enter a valid email address.', 'error');
      return;
    }

    showStatus('Launching message...', 'info');

    // Simulate server side submission
    setTimeout(() => {
      showStatus('Message successfully delivered! Talk to you soon.', 'success');
      contactForm.reset();
    }, 1800);
  });

  const showStatus = (text, type) => {
    formStatus.textContent = text;
    formStatus.className = 'form-status ' + type;

    if (type === 'success') {
      setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
      }, 5500);
    }
  };
}
