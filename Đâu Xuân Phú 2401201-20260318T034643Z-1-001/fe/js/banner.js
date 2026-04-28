document.addEventListener('DOMContentLoaded', function() {
  var slideImg = document.querySelectorAll('.slide_img');
  if (!slideImg.length) return;

  var i = 0;
  slideImg.forEach(function(img, idx) {
    if (idx !== 0) img.classList.remove('active_second');
  });

  setInterval(function() {
    slideImg[i].classList.remove('active_second');

    i++;
    if (i >= slideImg.length) {
      i = 0;
    }

    slideImg[i].classList.add('active_second');
  }, 10000);
});