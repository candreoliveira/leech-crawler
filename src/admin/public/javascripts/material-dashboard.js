/*!

 =========================================================
 * Material Dashboard - v2.1.0
 =========================================================

 * Product Page: https://www.creative-tim.com/product/material-dashboard
 * Copyright 2018 Creative Tim (http://www.creative-tim.com)

 * Designed by www.invisionapp.com Coded by www.creative-tim.com

 =========================================================

 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 */

(function () {
  // window.options = {};
  isWindows = navigator.platform.indexOf('Win') > -1 ? true : false;

  if (isWindows) {
    // if we are on windows OS we activate the perfectScrollbar function
    $('.sidebar .sidebar-wrapper, .main-panel').perfectScrollbar();

    $('html').addClass('perfect-scrollbar-on');
  } else {
    $('html').addClass('perfect-scrollbar-off');
  }

  // // Tell the browser not to handle scrolling when restoring via the history or
  // // when reloading
  // if ('scrollRestoration' in history) {
  //   history.scrollRestoration = 'manual'
  // }

  // var SCROLL_POSITION = 'scroll-position'
  // var PAGE_INVALIDATED = 'page-invalidated'

  // // Persist the scroll position on refresh
  // addEventListener('beforeunload', function () {
  //   sessionStorage.setItem(SCROLL_POSITION, JSON.stringify(scrollData()))
  // });

  // // Invalidate the page when the next page is different from the current page
  // // Persist scroll information across pages
  // document.addEventListener('turbolinks:before-visit', function (event) {
  //   if (event.data.url !== location.href) {
  //     sessionStorage.setItem(PAGE_INVALIDATED, 'true')
  //   }
  //   sessionStorage.setItem(SCROLL_POSITION, JSON.stringify(scrollData()))
  // })

  // // When a page is fully loaded:
  // // 1. Get the persisted scroll position
  // // 2. If the locations match and the load did not originate from a page
  // // invalidation,
  // // 3. scroll to the persisted position if there, or to the top otherwise
  // // 4. Remove the persisted information
  // addEventListener('turbolinks:load', function (event) {
  //   var scrollPosition = JSON.parse(sessionStorage.getItem(SCROLL_POSITION))

  //   if (shouldScroll(scrollPosition)) {
  //     scrollTo(scrollPosition.scrollX, scrollPosition.scrollY)
  //   } else {
  //     scrollTo(0, 0)
  //   }
  //   sessionStorage.removeItem(PAGE_INVALIDATED)
  // });

  // function shouldScroll(scrollPosition) {
  //   return (scrollPosition
  //     && scrollPosition.location === location.href
  //     && !JSON.parse(sessionStorage.getItem(PAGE_INVALIDATED)))
  // }

  // function scrollData() {
  //   return {
  //     scrollX: scrollX,
  //     scrollY: scrollY,
  //     location: location.href
  //   }
  // }
})();

var breakCards = true;

var searchVisible = 0;
var transparent = true;

var transparentDemo = true;
var fixedTop = false;

var mobile_menu_visible = 0,
  mobile_menu_initialized = false,
  toggle_initialized = false,
  bootstrap_nav_initialized = false;

var seq = 0,
  delays = 80,
  durations = 500;
var seq2 = 0,
  delays2 = 80,
  durations2 = 500;

window.rel = function () {
  window._metrics = JSON.parse(window._metricstr);
  $('body').bootstrapMaterialDesign();

  $sidebar = $('.sidebar');

  md.initSidebarsCheck();

  window_width = $(window).width();

  // check if there is an image set for the sidebar's background
  md.checkSidebarImage();

  //    Activate bootstrap-select
  if ($(".selectpicker").length != 0) {
    $(".selectpicker").selectpicker();
  }

  //  Activate the tooltips
  $('[rel="tooltip"]').tooltip();

  $('.form-control').on("focus", function () {
    $(this).parent('.input-group').addClass("input-group-focus");
  }).on("blur", function () {
    $(this).parent(".input-group").removeClass("input-group-focus");
  });

  // remove class has-error for checkbox validation
  $('input[type="checkbox"][required="true"], input[type="radio"][required="true"]').on('click', function () {
    if ($(this).hasClass('error')) {
      $(this).closest('div').removeClass('has-error');
    }
  });

}

$(document).ready(window.rel);

// function reloadActives() {
//   if (window.options.refreshChange) {
//     relClassClick($("#refresh > a[data-refresh=" + window.options.refresh + "]"), true);
//   }

//   if (window.options.mostTimeConsumingChange) {
//     relClassClick($("#mostTimeConsuming .nav-tabs li > a[href='" + window.options.mostTimeConsuming + "']"), true);
//   }
// }

// function relClassClick(el, click = false) {
//   var tgt = $(el);
//   tgt.parent().children(".active").removeClass("active");
//   tgt.addClass("active");

//   if (click) tgt.click();
// }

// window.interval = null;
// $("#refresh > a").on("click", (e) => {
//   var tgt = $(e.currentTarget);
//   relClassClick(tgt, false);

//   if (parseInt(tgt.data("refresh")) !== 0) {
//     window.options.refreshChange = true;
//     window.options.refresh = parseInt(tgt.data("refresh"));

//     interval = setInterval(() => {
//       window.Turbolinks.visit(window.location.href);
//     }, (parseInt(tgt.data("refresh")) * 1000));
//   } else {
//     if (interval) clearInterval(interval);
//   }
// });

// $("#mostTimeConsuming .nav-tabs li > a").on("click", (e) => {
//   window.options.mostTimeConsumingChange = true;
//   window.options.mostTimeConsuming = $(e.currentTarget).attr("href");
// });

// $(document).on("turbolinks:load", (e) => {
//   reloadActives();
// });

$(document).on('click', '.navbar-toggler', function () {
  $toggle = $(this);

  if (mobile_menu_visible == 1) {
    $('html').removeClass('nav-open');

    $('.close-layer').remove();
    setTimeout(function () {
      $toggle.removeClass('toggled');
    }, 400);

    mobile_menu_visible = 0;
  } else {
    setTimeout(function () {
      $toggle.addClass('toggled');
    }, 430);

    var $layer = $('<div class="close-layer"></div>');

    if ($('body').find('.main-panel').length != 0) {
      $layer.appendTo(".main-panel");

    } else if (($('body').hasClass('off-canvas-sidebar'))) {
      $layer.appendTo(".wrapper-full-page");
    }

    setTimeout(function () {
      $layer.addClass('visible');
    }, 100);

    $layer.click(function () {
      $('html').removeClass('nav-open');
      mobile_menu_visible = 0;

      $layer.removeClass('visible');

      setTimeout(function () {
        $layer.remove();
        $toggle.removeClass('toggled');

      }, 400);
    });

    $('html').addClass('nav-open');
    mobile_menu_visible = 1;

  }

});

// activate collapse right menu when the windows is resized
$(window).resize(function () {
  md.initSidebarsCheck();

  // reset the seq for charts drawing animations
  seq = seq2 = 0;

  setTimeout(function () {
    md.initDashboardPageCharts();
  }, 500);
});

md = {
  misc: {
    navbar_menu_visible: 0,
    active_collapse: true,
    disabled_collapse_init: 0,
  },

  checkSidebarImage: function () {
    $sidebar = $('.sidebar');
    image_src = $sidebar.data('image');

    if (image_src !== undefined) {
      sidebar_container = '<div class="sidebar-background" style="background-image: url(' + image_src + ') "/>';
      $sidebar.append(sidebar_container);
    }
  },

  initFormExtendedDatetimepickers: function () {
    $('.datetimepicker').datetimepicker({
      icons: {
        time: "fa fa-clock-o",
        date: "fa fa-calendar",
        up: "fa fa-chevron-up",
        down: "fa fa-chevron-down",
        previous: 'fa fa-chevron-left',
        next: 'fa fa-chevron-right',
        today: 'fa fa-screenshot',
        clear: 'fa fa-trash',
        close: 'fa fa-remove'
      }
    });

    $('.datepicker').datetimepicker({
      format: 'MM/DD/YYYY',
      icons: {
        time: "fa fa-clock-o",
        date: "fa fa-calendar",
        up: "fa fa-chevron-up",
        down: "fa fa-chevron-down",
        previous: 'fa fa-chevron-left',
        next: 'fa fa-chevron-right',
        today: 'fa fa-screenshot',
        clear: 'fa fa-trash',
        close: 'fa fa-remove'
      }
    });

    $('.timepicker').datetimepicker({
      //          format: 'H:mm',    // use this format if you want the 24hours timepicker
      format: 'h:mm A', //use this format if you want the 12hours timpiecker with AM/PM toggle
      icons: {
        time: "fa fa-clock-o",
        date: "fa fa-calendar",
        up: "fa fa-chevron-up",
        down: "fa fa-chevron-down",
        previous: 'fa fa-chevron-left',
        next: 'fa fa-chevron-right',
        today: 'fa fa-screenshot',
        clear: 'fa fa-trash',
        close: 'fa fa-remove'

      }
    });
  },


  initSliders: function () {
    // Sliders for demo purpose
    var slider = document.getElementById('sliderRegular');

    noUiSlider.create(slider, {
      start: 40,
      connect: [true, false],
      range: {
        min: 0,
        max: 100
      }
    });

    var slider2 = document.getElementById('sliderDouble');

    noUiSlider.create(slider2, {
      start: [20, 60],
      connect: true,
      range: {
        min: 0,
        max: 100
      }
    });
  },

  initSidebarsCheck: function () {
    if ($(window).width() <= 991) {
      if ($sidebar.length != 0) {
        md.initRightMenu();
      }
    }
  },

  initDashboardPageCharts: function () {

    if ($('#dailySalesChart').length != 0 || $('#completedTasksChart').length != 0 || $('#totalStatusChart').length != 0) {
      /* ----------==========     Chart initialization     ==========---------- */
      var statuses = window._metrics.metrics.map(v => String(v.statusCode));
      var totals = window._metrics.metrics.map(v => v.total);
      var times = window._metrics.metrics.map(v => (v.avgTime / 1000));

      // Fix chartist 1 bar error
      if (statuses.length === 1) {
        statuses.push("Loading");
        totals.push(0);
        times.push(0);
      }

      var totalStatusChart = Chartist.Bar(
        '#totalStatusChart',
        {
          labels: statuses,
          series: [totals]
        },
        {
          low: Math.min.apply(null, totals),
          high: Math.max.apply(null, totals),
          reverseData: true,
          horizontalBars: true
        },
        [
          ['screen and (max-width: 640px)', {
            seriesBarDistance: 5,
            axisX: {
              labelInterpolationFnc: function (value) {
                return value[0];
              }
            }
          }]
        ]
      );

      var timeStatusChart = Chartist.Bar(
        '#timeStatusChart',
        {
          labels: statuses,
          series: [times]
        },
        {
          low: Math.min.apply(null, times),
          high: Math.max.apply(null, times),
          reverseData: true,
          horizontalBars: true
        },
        [
          ['screen and (max-width: 640px)', {
            seriesBarDistance: 5,
            axisX: {
              labelInterpolationFnc: function (value) {
                return value[0];
              }
            }
          }]
        ]
      );

      //start animation for the Emails Subscription Chart
      md.startAnimationForBarChart(totalStatusChart);
      md.startAnimationForBarChart(timeStatusChart);
    }
  },

  initMinimizeSidebar: function () {

    $('#minimizeSidebar').click(function () {
      var $btn = $(this);

      if (md.misc.sidebar_mini_active == true) {
        $('body').removeClass('sidebar-mini');
        md.misc.sidebar_mini_active = false;
      } else {
        $('body').addClass('sidebar-mini');
        md.misc.sidebar_mini_active = true;
      }

      // we simulate the window Resize so the charts will get updated in realtime.
      var simulateWindowResize = setInterval(function () {
        window.dispatchEvent(new Event('resize'));
      }, 180);

      // we stop the simulation of Window Resize after the animations are completed
      setTimeout(function () {
        clearInterval(simulateWindowResize);
      }, 1000);
    });
  },

  checkScrollForTransparentNavbar: debounce(function () {
    if ($(document).scrollTop() > 260) {
      if (transparent) {
        transparent = false;
        $('.navbar-color-on-scroll').removeClass('navbar-transparent');
      }
    } else {
      if (!transparent) {
        transparent = true;
        $('.navbar-color-on-scroll').addClass('navbar-transparent');
      }
    }
  }, 17),


  initRightMenu: debounce(function () {
    $sidebar_wrapper = $('.sidebar-wrapper');

    if (!mobile_menu_initialized) {
      $navbar = $('nav').find('.navbar-collapse').children('.navbar-nav');

      mobile_menu_content = '';

      nav_content = $navbar.html();

      nav_content = '<ul class="nav navbar-nav nav-mobile-menu">' + nav_content + '</ul>';

      // navbar_form = $('nav').find('.navbar-form').get(0).outerHTML;

      $sidebar_nav = $sidebar_wrapper.find(' > .nav');

      // insert the navbar form before the sidebar list
      $nav_content = $(nav_content);
      // $navbar_form = $(navbar_form);
      $nav_content.insertBefore($sidebar_nav);
      // $navbar_form.insertBefore($nav_content);

      $(".sidebar-wrapper .dropdown .dropdown-menu > li > a").click(function (event) {
        event.stopPropagation();

      });

      // simulate resize so all the charts/maps will be redrawn
      window.dispatchEvent(new Event('resize'));

      mobile_menu_initialized = true;
    } else {
      if ($(window).width() > 991) {
        // reset all the additions that we made for the sidebar wrapper only if the screen is bigger than 991px
        $sidebar_wrapper.find('.navbar-form').remove();
        $sidebar_wrapper.find('.nav-mobile-menu').remove();

        mobile_menu_initialized = false;
      }
    }
  }, 200),

  startAnimationForLineChart: function (chart) {

    chart.on('draw', function (data) {
      if (data.type === 'line' || data.type === 'area') {
        data.element.animate({
          d: {
            begin: 600,
            dur: 700,
            from: data.path.clone().scale(1, 0).translate(0, data.chartRect.height()).stringify(),
            to: data.path.clone().stringify(),
            easing: Chartist.Svg.Easing.easeOutQuint
          }
        });
      } else if (data.type === 'point') {
        seq++;
        data.element.animate({
          opacity: {
            begin: seq * delays,
            dur: durations,
            from: 0,
            to: 1,
            easing: 'ease'
          }
        });
      }
    });

    seq = 0;
  },
  startAnimationForBarChart: function (chart) {

    chart.on('draw', function (data) {
      if (data.type === 'bar') {
        seq2++;
        data.element.animate({
          opacity: {
            begin: seq2 * delays2,
            dur: durations2,
            from: 0,
            to: 1,
            easing: 'ease'
          }
        });
      }
    });

    seq2 = 0;
  }
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.

function debounce(func, wait, immediate) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
    if (immediate && !timeout) func.apply(context, args);
  };
};