let loadingPage = document.querySelector(".loadingPage"),
        body = document.body;

window.addEventListener("DOMContentLoaded", function () {
        
        setTimeout(() => {
                loadingPage.classList.add("hide")
        }, 1500);

        setTimeout(() => {
                loadingPage.classList.add("inactive");
                body.classList.remove("no-scroll");
        }, 2501);
})