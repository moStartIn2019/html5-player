/**
 *  关于audio的一些常用属性
 *    duration：播放的总时间（s）
 *    currentTime：当前已经播放的时间（s）
 *    ended：是否已经播放完成
 *    paused：当前是否为暂停状态
 *    volume：控制音量（0~1）
 * 
 *    【方法】
 *     pause() 暂停
 *     play() 播放
 * 
 *    【事件on】
 *     canplay：可以正常播放（但是播放过程中可能出现卡顿）
 *     canplaythrough：资源加载完毕，可以顺畅的播放
 *     ended：播放完成
 *     loadedmetadata：资源的基础信息（元数据）已经加载完成
 *     loadeddata：整个资源都加载完成
 *     pause：触发了暂停
 *     play：触发了播放
 *     playing：正在播放中
 */

let playerRender = (function() {
  let $playerHeader = $('.playerHeader'),
      $lyrics = $('.lyrics'),
      $playerFooter = $('.playerFooter'),
      $wrapper = $lyrics.find('.wrapper'),
      $lyricList = null;
      // 转为原生js元素
      music = $('.music')[0],
      $playerBtn = $playerHeader.find('.playerBtn'),
      $downloadBtn = $playerFooter.find('.downloadBtn'),
      $leftTime = $playerFooter.find('.leftTime'),
      $rightTime = $playerFooter.find('.rightTime');
      $currentBar = $playerFooter.find('.currentBar');

  // 计算lyrics区域的高度
  let computedLyrics = function() {
    let de = document.documentElement,
        winH = de.clientHeight,
        font = parseFloat(de.style.fontSize);
        // documentElement和body的区别
        // console.log(document.documentElement)
        // console.log(document.body)
    $lyrics.css({
      height: winH - $playerHeader[0].offsetHeight - $playerFooter[0].offsetHeight - font * 0.40});
  }

  // 获取歌词
  let queryLyrics = function() {
    return new Promise(resolve => {
      $.ajax({
        url: 'json/lyric.json',
        dataType: 'json',
        success: resolve
      });
    });
  };

  // 绑定歌词
  let bindHTML = function(lyricArray) {
    let str = '';
    lyricArray.forEach(item => {
      let {minutes, seconds, content} = item;
      str += `<p data-minutes="${minutes}" data-seconds="${seconds}">${content}</p>`
    });
    $wrapper.html(str);
    // find返回多个p标签给$lyricList成为数组
    $lyricList = $wrapper.find('p');
  };

  // 开始播放
  let $callbacks = $.Callbacks();
  let startPlay = function() {
    music.play();
    // 触发canplay时间，就执行callbacks的回调函数
    music.addEventListener('canplay', $callbacks.fire)
  };

  // 控制暂停播放
  $callbacks.add(() => {
    $playerBtn.css('display', 'block')
              .addClass('start');
    // 移动端没有click，有tap,touch
    $playerBtn.tap(() => {
      if(music.paused) {
        // 暂停状态就播放
        music.play();
        $playerBtn.addClass('start');
        // 阻止下面代码很重要！
        return;
      }
      // 播放状态就暂停
      music.pause();
      $playerBtn.removeClass('start')
    })
  });

  // 控制music进度条
  let musicTime = null;
  $callbacks.add(() => {
    // 获取audio总的播放时间，ms单位，需要转化
    let duration = music.duration;
    $rightTime.html(computedTime(duration));
    $leftTime.html('00:00');
    // 监听播放状态,需要用到定时器
    autoTimer = setInterval(() => {
      // audio当前的播放时间，单位ms
      let currentTime = music.currentTime;
      // 播放完成,清除监听
      if(currentTime >= duration) {
        clearInterval(autoTimer);
        $leftTime.html(computed(duration));
        // 进度条100%
        $currentBar.css('width', '100%');
        music.pause();
        $playerBtn.removeClass('start');
        return;
      }
      // 正在播放的状态
      $leftTime.html(computedTime(currentTime));
      // 播放进度条,根据currentTime来决定
      $currentBar.css('width', currentTime / duration * 100 + '%');
      // 匹配歌词,需要将currentTime对比lyric的p标签的data-minutes和data-seconds
      matchLyric(currentTime);
     }, 1000); 
  });

  // 转化时间
  let computedTime = function(time) {
    // 分钟
    let minutes = Math.floor(time / 60),
        seconds = Math.floor(time % 60);
    minutes < 10 ? minutes = '0' + minutes : null;
    seconds < 10 ? seconds = '0' + seconds : null;
    return `${minutes}:${seconds}`;
  };

  // currentTime匹配歌词实现歌词对应
  // 需要改变lyrics的wrapper的Y轴位置
  let lyricY = 0;
  let matchLyric = function(currentTime) {
    let [minutes, seconds] = computedTime(currentTime).split(':');
    // console.log($lyricList)
    let $cur = $lyricList.filter(`[data-minutes="${minutes}"]`)
                         .filter(`[data-seconds="${seconds}"]`);
    // 当前歌词若已被选中，如果歌词持续几秒，那么定时器每1秒执行一次那么歌词就要被执行几次，
    // 这是不必要的，执行一次就够了，需return
    if($cur.hasClass('.active')) return;
    // 记录每次相对于$cur对应的index
    let index = $cur.index();
    $cur.addClass('active')
        .siblings().removeClass('active');
    // 当对应的歌词已经到第6条时候，每条歌词需要让wrapper往上移一个offsetHeight
    if(index >= 5) {
      // 转原生js调用offHeight
      let curHeight = $cur[0].offsetHeight;
      // 每次都要减去curHeight
      lyricY -= curHeight;
      $wrapper.css('transform', `translateY(${lyricY}px)`);
    }
  }



  return {
    init() {
      computedLyrics();
      let promise = queryLyrics();
      promise.then(result => {
        let {lyric =''} = result,
            obj = {32: '', 40: '(', 41: ')', 45: '-'};
            // console.log(lyric)
        lyric = lyric.replace(/&#(\d+)/g, (...arg) => {
          let [item, num] = arg;
          // console.log(arg)
          // console.log(item,num);
          item = obj[num] || item;
          return item;
        })
        return lyric;// 上一个then方法中返回的结果会作为下一个then实参传递过去
      })
      .then(lyric => {
        lyric += '&#10;'; // 向歌词末尾直接结束符
        let lyricArray = [],
            reg = /\[(\d+)&#58;(\d+)&#46;(\d+)\]([^&#]+)&#10;/g;
        lyric.replace(reg, (...arg) => {
          // console.log(arg);
          [, minutes, seconds, , content] = arg;
          // console.log(minutes, seconds, content)
          lyricArray.push({
            minutes,
            seconds,
            content
          });   
        });
        return lyricArray;
      })
      .then(
        // lyricArray => {
        // console.log($wrapper.find('p')[0].innerHTML)
        // $wrapper.find('p')[0].innerHTML = lyricArray.reduce((init, item) => {
        //   let content = item.content + '<br>';
        //   init += item.content;
        //   return init;}, '')
        // console.log($wrapper.find('p')[0].innerHTML)}
        bindHTML
      )
      .then(startPlay);
    }
  }
})();

playerRender.init();