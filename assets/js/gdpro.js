// Portfolio Data
const portfolioData = [
    { id: 1, title: "Լեռնային Բնապատկեր", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/104/800/600", largeImage: "https://picsum.photos/id/104/1200/900" },
    { id: 2, title: "Ժամանակակից Ճարտարապետություն", category: "architecture", categoryLabel: "Ճարտարապետություն", image: "https://picsum.photos/id/20/800/600", largeImage: "https://picsum.photos/id/20/1200/900" },
    { id: 3, title: "Արվեստի Ստուդիա", category: "art", categoryLabel: "Արվեստ", image: "https://picsum.photos/id/30/800/600", largeImage: "https://picsum.photos/id/30/1200/900" },
    { id: 4, title: "Ծովափնյա Հանգիստ", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/15/800/600", largeImage: "https://picsum.photos/id/15/1200/900" },
    { id: 5, title: "Մինիմալիստական Ինտերիեր", category: "architecture", categoryLabel: "Ճարտարապետություն", image: "https://picsum.photos/id/42/800/600", largeImage: "https://picsum.photos/id/42/1200/900" },
    { id: 6, title: "Ժամանակակից Նկարչություն", category: "art", categoryLabel: "Արվեստ", image: "https://picsum.photos/id/96/800/600", largeImage: "https://picsum.photos/id/96/1200/900" },
    { id: 7, title: "Անտառային Լանդշաֆտ", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/108/800/600", largeImage: "https://picsum.photos/id/108/1200/900" },
    { id: 8, title: "Քաղաքային Լուսանկարներ", category: "architecture", categoryLabel: "Ճարտարապետություն", image: "https://picsum.photos/id/0/800/600", largeImage: "https://picsum.photos/id/0/1200/900" },
    { id: 9, title: "Աբստրակտ Արվեստ", category: "art", categoryLabel: "Արվեստ", image: "https://picsum.photos/id/91/800/600", largeImage: "https://picsum.photos/id/91/1200/900" },
    { id: 10, title: "Լեռնագագաթ", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/29/800/600", largeImage: "https://picsum.photos/id/29/1200/900" },
    { id: 11, title: "Մոդեռն Դիզայն", category: "architecture", categoryLabel: "Ճարտարապետություն", image: "https://picsum.photos/id/26/800/600", largeImage: "https://picsum.photos/id/26/1200/900" },
    { id: 12, title: "Գրաֆիտի Արվեստ", category: "art", categoryLabel: "Արվեստ", image: "https://picsum.photos/id/32/800/600", largeImage: "https://picsum.photos/id/32/1200/900" },
    { id: 13, title: "Ծովային Տեսարան", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/58/800/600", largeImage: "https://picsum.photos/id/58/1200/900" },
    { id: 14, title: "Բարձրահարկ Շենքեր", category: "architecture", categoryLabel: "Ճարտարապետություն", image: "https://picsum.photos/id/22/800/600", largeImage: "https://picsum.photos/id/22/1200/900" },
    { id: 15, title: "Դիմանկար", category: "art", categoryLabel: "Արվեստ", image: "https://picsum.photos/id/84/800/600", largeImage: "https://picsum.photos/id/84/1200/900" },
    { id: 16, title: "Արևածագ Սարերում", category: "nature", categoryLabel: "Բնություն", image: "https://picsum.photos/id/175/800/600", largeImage: "https://picsum.photos/id/175/1200/900" }
];

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initPortfolio();
});

function initPortfolio() {
    // DOM Elements
    const filterButtons = document.querySelectorAll('.filter-btn');
    const gridContainer = document.getElementById('portfolioGrid');
    const activeFilterLabel = document.getElementById('activeFilterLabel');
    const countDisplay = document.getElementById('countDisplay');
    const countAll = document.getElementById('countAll');
    const countNature = document.getElementById('countNature');
    const countArchitecture = document.getElementById('countArchitecture');
    const countArt = document.getElementById('countArt');
    
    // Check if elements exist
    if (!gridContainer) {
        console.error('Portfolio grid container not found!');
        return;
    }
    
    let currentFilter = 'all';
    
    // Update count displays
    const updateCounts = () => {
        const natureCount = portfolioData.filter(item => item.category === 'nature').length;
        const architectureCount = portfolioData.filter(item => item.category === 'architecture').length;
        const artCount = portfolioData.filter(item => item.category === 'art').length;
        
        if (countAll) countAll.textContent = portfolioData.length;
        if (countNature) countNature.textContent = natureCount;
        if (countArchitecture) countArchitecture.textContent = architectureCount;
        if (countArt) countArt.textContent = artCount;
    };
    
    // Render gallery based on filter
    const renderGallery = () => {
        let filteredData = portfolioData;
        if (currentFilter !== 'all') {
            filteredData = portfolioData.filter(item => item.category === currentFilter);
        }
        
        // Update result info
        if (activeFilterLabel) {
            if (currentFilter === 'all') {
                activeFilterLabel.textContent = 'Բոլորը';
            } else if (currentFilter === 'nature') {
                activeFilterLabel.textContent = 'Բնություն';
            } else if (currentFilter === 'architecture') {
                activeFilterLabel.textContent = 'Ճարտարապետություն';
            } else if (currentFilter === 'art') {
                activeFilterLabel.textContent = 'Արվեստ';
            }
        }
        
        if (countDisplay) countDisplay.textContent = filteredData.length;
        
        if (filteredData.length === 0) {
            gridContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open" style="font-size: 2rem;"></i>
                    <p style="margin-top: 0.5rem;">Այս կատեգորիայում նկարներ չկան</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        filteredData.forEach(item => {
            html += `
                <div class="portfolio-item" data-id="${item.id}" data-category="${item.category}" data-image="${item.largeImage}" data-title="${item.title}" data-catlabel="${item.categoryLabel}">
                    <img src="${item.image}" alt="${item.title}" loading="lazy">
                    <div class="zoom-icon">
                        <i class="fas fa-search-plus"></i>
                    </div>
                    <div class="item-overlay">
                        <h4>${item.title}</h4>
                        <p>${item.categoryLabel}</p>
                    </div>
                </div>
            `;
        });
        gridContainer.innerHTML = html;
        
        // Add click event to each portfolio item
        document.querySelectorAll('.portfolio-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const imageSrc = item.getAttribute('data-image');
                const title = item.getAttribute('data-title');
                const category = item.getAttribute('data-catlabel');
                openLightbox(imageSrc, title, category);
            });
        });
    };
    
    // Lightbox functionality
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const closeLightboxBtn = document.getElementById('closeLightbox');
    
    const openLightbox = (imageSrc, title, category) => {
        if (lightboxImage && lightboxCaption && lightbox) {
            lightboxImage.src = imageSrc;
            lightboxCaption.innerHTML = `${title} - ${category}`;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };
    
    const closeLightbox = () => {
        if (lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
            if (lightboxImage) lightboxImage.src = '';
        }
    };
    
    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener('click', closeLightbox);
    }
    
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox && lightbox.classList.contains('active')) closeLightbox();
    });
    
    // Filter functionality
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                // Update current filter
                currentFilter = btn.getAttribute('data-filter');
                // Re-render gallery
                renderGallery();
            });
        });
    }
    
    // Add .js class to hide no-js warning
    document.documentElement.classList.add('js');
    
    // Initialize
    updateCounts();
    renderGallery();
}
