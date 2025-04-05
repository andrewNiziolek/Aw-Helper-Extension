var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function () {
    // Close others
    for (var j = 0; j < coll.length; j++) {
      if (coll[j] !== this && coll[j].classList.contains("active")) {
        coll[j].classList.remove("active");
        coll[j].nextElementSibling.style.maxHeight = null;
        const otherIcon = coll[j].querySelector(".collapsible-icon");
        if (otherIcon) otherIcon.textContent = "+";
      }
    }
  
    // Toggle this
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  
    // Update this icon
    const icon = this.querySelector(".collapsible-icon");
    if (icon) icon.textContent = this.classList.contains("active") ? "−" : "+";
  });
  
}
