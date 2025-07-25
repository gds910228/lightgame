﻿﻿function load_page_1(){
    $("#c1").css("display","block");
    $("#c2").css("display","block");
    $("#c2").addClass("imgElementClick");
    $("#c3").css("display","block");
    $("#c4").css("display","block");
}

function load_page_2(){
    $("#c1").css("display","block");
    $("#c2").css("display","none");
    $("#c3").css("display","none");
    $("#c4").css("display","none");
    $("#c29").css("display","block");
    $("#c29").addClass("imgElementClick");
    $("#c18").addClass("imgElementClick");
    $("#c19").addClass("imgElementClick");
    $("#c30").css("display","block");
    $("#c21").css("display","block");
    $("#c25").css("display","block");
    $("#c13").css("display","block");
    $("#c14").css("display","block");
    $("#c14_").css("display","block");
    $("#c16").css("display","block");
    $("#c17").css("display","block");
    $("#c5").css("display","block");
    $("#c6").css("display","block");
}

var baozi_max = 50;
var eat_max_time = 15;
var first_eat = true;
var finish_eat = false;
var eat_count = 0;
var anim_count = 0;
var animArr_1 = ["#c28","#c26","#c27","#c26","#c27"];
var animArr_2 = ["#c34","#c31","#c32","#c33","#c35"];
var animArr_3 = ["#c35m","#c34m","#c31m","#c32m","#c33m"];

function tmpFn(){
    if(anim_count > 4){
        anim_count = 0;
    }
    if(anim_count == 2 || anim_count == 4){
        eat_count++;
        $("#c14_").html("x " + eat_count);
    }
    if(eat_count > baozi_max * 0.33 && eat_count < baozi_max * 0.66){
        $("#c6").css("display","none");
        $("#c7").css("display","block");
    } else if(eat_count > baozi_max * 0.66){
        $("#c7").css("display","none");
        $("#c8").css("display","block");
    }
    
    animArr_1.forEach(function(a){
        $(a).css("display","none");
    });
    $(animArr_1[anim_count]).css("display","block");
    
    animArr_2.forEach(function(a){
        $(a).css("display","none");
    });
    $(animArr_2[anim_count]).css("display","block");
    
    animArr_3.forEach(function(a){
        $(a).css("display","none");
    });
    $(animArr_3[anim_count]).css("display","block");
    
    anim_count++;
}

function winORlose(){
    if(finish_eat == true){
        return;
    } else {
        finish_eat = true;
    }
    
    $("#c29").css("display","none");
    $("#c10").css("display","block");
    
    animArr_1.forEach(function(a){
        $(a).css("display","none");
    });
    animArr_2.forEach(function(a){
        $(a).css("display","none");
    });
    animArr_3.forEach(function(a){
        $(a).css("display","none");
    });
    
    if(eat_count <= 20){
        $("#c22").css("display","block");
    } else if(eat_count > 20 && eat_count <= 40){
        $("#c23").css("display","block");
    } else if(eat_count > 40){
        $("#c24").css("display","block");
    }
    
    setTimeout(function(){
        $("#c10").css("display","none");
        $("#c11").css("display","block");
        $("#c36").css("display","block");
        $("#c12").css("display","block");
        $("#c18").css("display","block");
        $("#c19").css("display","block");
        $("#c20").css("display","block");
        
        var chat = "";
        var share = "";
        var share_imgUrl = "/images/thumbnails/baozi.svg";
        
        if(eat_count <= 20){
            chat = eat_count + " buns is not enough! Bun Eater must be awesome!!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 5% of players!";
        } else if(eat_count <= 35){
            chat = "Oh my! You only ate " + eat_count + " buns, keep practicing!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 15% of players!";
        } else if(eat_count <= 50){
            chat = "Not bad! You ate " + eat_count + " buns in one go. Don't forget to drink some soup!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 25% of players!";
        } else if(eat_count <= 65){
            chat = "Incredible! You ate " + eat_count + " buns! Be brave, eat more!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 35% of players!";
        } else if(eat_count <= 80){
            chat = "You ate " + eat_count + " buns. Looks like you can't stop! Keep going!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 45% of players!";
        } else if(eat_count <= 95){
            chat = "You ate " + eat_count + " buns. At this speed, you're a standard foodie!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 55% of players!";
        } else if(eat_count <= 110){
            chat = "You ate " + eat_count + " buns. You have extraordinary talent for eating!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 65% of players!";
        } else if(eat_count <= 125){
            chat = "Oh my! You ate " + eat_count + " buns... What can I say? Remember to take medicine...";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 75% of players!";
        } else if(eat_count <= 140){
            chat = "You ate " + eat_count + " buns. Such speed is godlike!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 85% of players!";
        } else {
            chat = "Wow! You actually ate " + eat_count + " buns. You're like a god of eating!";
            share = "I ate " + eat_count + " buns in the Bun Eating Contest and beat 95% of players!";
        }
        
        $("#c20").html(chat);
        
        // Store share data for sharing functionality
        window.gameShareData = {
            title: "Bun Eating Contest - LightGame",
            text: share,
            url: window.location.href
        };
        
    }, 2000);
}

// Event handlers
$(document).on("click touchstart", "#c2", function(e){
    e.preventDefault();
    e.stopPropagation();
    load_page_2();
});

$(document).on("click touchstart", "#c29", function(e){
    e.preventDefault();
    e.stopPropagation();
    if(first_eat == true){
        $("#c17").animate({width: 0}, eat_max_time * 1000, winORlose);
        first_eat = false;
    }
    $("#c25").css("display","none");
    tmpFn();
});

$(document).on("click touchstart", "#c18", function(e){
    e.preventDefault();
    e.stopPropagation();
    $("#container").html("");
    window.location.reload();
});

// Updated sharing functionality - now uses standard web sharing
$(document).on("click touchstart", "#c19", function(e){
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Share button clicked!");
    console.log("Game share data:", window.gameShareData);
    
    // Try to share the game result if available
    if(window.gameShareData) {
        console.log("Attempting to share game result");
        handleGameShare();
    } else {
        console.log("No game share data, going to home");
        // Default behavior - go back to home
        window.location.href = "/";
    }
});

// Standard web sharing function (similar to other games)
async function handleGameShare() {
    console.log("handleGameShare called");
    const shareData = window.gameShareData;
    console.log("Share data:", shareData);
    
    // Try to use Web Share API first (mobile devices)
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
            console.log("Using Web Share API");
            await navigator.share(shareData);
            showNotification('Game result shared successfully!', 'success');
            return;
        } catch (error) {
            console.log('Web Share API failed:', error);
        }
    }
    
    // Fallback: Copy to clipboard
    try {
        console.log("Using clipboard fallback");
        const textToShare = shareData.url + ' - ' + shareData.text;
        console.log("Text to share:", textToShare);
        await navigator.clipboard.writeText(textToShare);
        showNotification('Game result copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showNotification('Failed to share game result', 'error');
        // Final fallback - go back to home
        setTimeout(() => {
            window.location.href = "/";
        }, 1000);
    }
}

// Simple notification function
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        font-size: 14px;
        max-width: 300px;
        word-wrap: break-word;
        transition: all 0.3s ease;
        transform: translateX(100%);
        ${type === 'success' ? 'background-color: #10b981;' : 'background-color: #ef4444;'}
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Aggressive overlay removal function
function removeShareOverlays() {
    // Remove elements with share-related classes and IDs
    $('[class*="share"], [class*="wx"], [id*="share"], [id*="wx"]').remove();
    $('[class*="guide"], [class*="finger"], [class*="pointer"]').remove();
    $('.wx_tip, .wx_tip_container, .wx_share_tip, .share_tip').remove();
    $('.share-popup, .share-overlay, .share-guide, .guide-overlay').remove();
    $('.wechat-share, .wx-share, .share-tooltip, .share-hint').remove();
    
    // Remove any elements containing Chinese share text
    $('*').each(function() {
        var $this = $(this);
        var text = $this.text();
        if (text.includes('分享') || text.includes('朋友圈') || text.includes('好友') || 
            text.includes('分享到') || text.includes('点击右上角')) {
            $this.remove();
        }
    });
    
    // Hide high z-index floating elements
    $('div, span').each(function() {
        var $this = $(this);
        var style = $this.attr('style') || '';
        var zIndex = $this.css('z-index');
        
        if ((style.includes('position: fixed') || style.includes('position: absolute')) &&
            (parseInt(zIndex) > 100 || zIndex === 'auto')) {
            var text = $this.text();
            if (text.includes('分享') || text.includes('朋友圈') || text.includes('好友') ||
                text.includes('右上角') || text.includes('点击') || $this.find('img').length > 0) {
                $this.remove();
            }
        }
    });
}

// Continuous monitoring and removal
function startOverlayMonitoring() {
    // Remove overlays immediately
    removeShareOverlays();
    
    // Set up continuous monitoring
    setInterval(removeShareOverlays, 500);
    
    // Also monitor for DOM changes
    if (window.MutationObserver) {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    setTimeout(removeShareOverlays, 100);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

$(function(){
    // Game initialization
    
    // Start aggressive overlay monitoring
    startOverlayMonitoring();
    
    // Also run removal after page load
    $(window).on('load', function() {
        setTimeout(removeShareOverlays, 1000);
    });
});
