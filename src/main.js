const random = require("lodash/random");
const tooltip = require("tooltip");
const anime = require("animejs");

var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");
var inside = 0; 
var outside = 0;
var piScore = 0;
var error = 0;
var known = [];

function initialize() {
  context.beginPath();
  context.arc(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2,
    0,
    Math.PI * 2
  );
  context.strokeStyle = "#9b4dca";
  context.stroke();

  Plotly.plot(
    "error_plot",
    [
      //error
      {
        y: [],
        name: "Error",
        mode: "lines",
        line: { color: "#CC8B14" }
      },
      //pi
      {
        y: [],
        name: "Pi",

        mode: "lines",
        line: { color: "#763D99" }
      }
    ],
    {
      margin: {
        t: 30, //top margin
        l: 20, //left margin
        r: 20, //right margin
        b: 20 //bottom margin
        },
      showlegend: false,
      plot_bgcolor: "#f4f5f6",
      paper_bgcolor: "#f4f5f6"
    },
    {responsive: true}
  );
  tooltip();
}

function intro() {
  anime.timeline({ loop: false }).add({
    targets: ".intro",
    duration: 1500,
    elasticity: 500,
    delay: function(t, i) {
      return i * 15;
    },
    opacity: {
      value: [0, 1],
      duration: 300,
      easing: "linear"
    },
    translateX: function() {
      return [anime.random(0, 1) === 0 ? 100 : -100, 0];
    },
    translateY: function() {
      return [anime.random(0, 1) === 0 ? 100 : -100, 0];
    }
  });
}

function isInCircle(x, y) {
  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const radius = canvas.width / 2;
  const dist_points =  (originX - x) * (originX - x) + (originY - y) * (originY - y);
  return dist_points <= radius * radius;
}

function setPixel(x, y) {
  context.beginPath();
  context.moveTo(x, y);
  isInCircle(x, y)
    ? (context.strokeStyle = "#FFCF40")
    : (context.strokeStyle = "#1400FF");
  context.lineTo(x + 0.4, y + 0.4);
  context.stroke();
}

function updateData() {
  document.getElementById("in").innerText = "inside: " + inside;
  document.getElementById("out").innerText = "outside: " + outside;
  document.getElementById("pi").innerText = "π: " + piScore;
  document.getElementById("error").innerText =
    "error " + parseFloat(error).toFixed(2) + "%";
}

function runMainLoop() {
  setInterval(() => {
    let x = random(0, canvas.width, false);
    let y = random(0, canvas.height, false);

    if (!known.find(p => p.x == x && p.y == y)) {
      setPixel(x, y);

      isInCircle(x, y) ? inside++ : outside++;

      piScore = (4 * inside) / (inside + outside);

      error = (Math.abs(piScore - Math.PI) / Math.PI) * 100;

      if (error < 10) {
        Plotly.extendTraces(
          "error_plot",
          {
            y: [[error], [piScore]]
          },
          [0, 1]
        );
      }

      updateData();
      known.push({ x: x, y: y });
    }
  });
}

(function() {
  initialize();
  intro();
  runMainLoop();
})();
