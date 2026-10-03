FROM nginx:alpine

COPY index.html style.css game.js core.js /usr/share/nginx/html/

EXPOSE 80
