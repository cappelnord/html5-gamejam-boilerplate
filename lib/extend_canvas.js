// http://webreflection.blogspot.de/2009/01/ellipse-and-circle-for-canvas-2d.html

(function(){
// Andrea Giammarchi - Mit Style License
var extend = {
    // Circle methods
    circle:function(aX, aY, aDiameter){
        this.ellipse(aX, aY, aDiameter, aDiameter);
    },
    fillCircle:function(aX, aY, aDiameter){
        this.beginPath();
        this.circle(aX, aY, aDiameter);
        this.fill();
    },
    strokeCircle:function(aX, aY, aDiameter){
        this.beginPath();
        this.circle(aX, aY, aDiameter);
        this.stroke();
    },
    // Ellipse methods
    ellipse:function(aX, aY, aWidth, aHeight){
        var hB = (aWidth / 2) * .5522848,
            vB = (aHeight / 2) * .5522848,
            eX = aX + aWidth,
            eY = aY + aHeight,
            mX = aX + aWidth / 2,
            mY = aY + aHeight / 2;
        this.moveTo(aX, mY);
        this.bezierCurveTo(aX, mY - vB, mX - hB, aY, mX, aY);
        this.bezierCurveTo(mX + hB, aY, eX, mY - vB, eX, mY);
        this.bezierCurveTo(eX, mY + vB, mX + hB, eY, mX, eY);
        this.bezierCurveTo(mX - hB, eY, aX, mY + vB, aX, mY);
        this.closePath();
    },
    fillEllipse:function(aX, aY, aWidth, aHeight){
        this.beginPath();
        this.ellipse(aX, aY, aWidth, aHeight);
        this.fill();
    },
    strokeEllipse:function(aX, aY, aWidth, aHeight){
        this.beginPath();
        this.ellipse(aX, aY, aWidth, aHeight);
        this.stroke();
    },

    // some own stuff by cappelnord
    drawImageC:function(img, x, y, width, height, rotation) {
        if(width == undefined) {
            width = img.width;
        }
        if(height == undefined) {
            height = img.height;
        }

        if(rotation == undefined) {
            this.drawImage(img, x - width/2, y - height/2, width, height);
        } else {
            this.save();
            this.translate(x, y);
            this.rotate(rotation);
            this.drawImage(img, -width/2, -height/2, width, height);
            this.restore();
        }
    },

    hsv2rgb:function(hsv) {
        var h = Math.max(0, Math.min(1, hsv[0]));
        var s = Math.max(0, Math.min(1, hsv[1]));
        var v = Math.max(0, Math.min(1, hsv[2]));

        var hi = Math.floor(h * 6);
        var f = (h*6) - hi;

        var p = v * (1 - s);
        var q = v * (1 - s * f);
        var t = v * (1 - s * (1 - f));

        var rgb = [v, t, p];
        if (hi == 1) {rgb = [q, v, p];}
        else if (hi == 2) {rgb = [p, v, t];}
        else if (hi == 3) {rgb = [p, q, v];}
        else if (hi == 4) {rgb = [t, p, v];}
        else if (hi == 5) {rgb = [v, p, q];}

        rgb[0] = rgb[0] * 255;
        rgb[1] = rgb[1] * 255;
        rgb[2] = rgb[2] * 255;

        return rgb;
    },
    rgb2hsv:function(rgb) {
        var r = Math.max(0, Math.min(255, rgb[0])) / 255;
        var g = Math.max(0, Math.min(255, rgb[1])) / 255;
        var b = Math.max(0, Math.min(255, rgb[2])) / 255;

        var maxv = Math.max(r, Math.max(g, b));
        var minv = Math.min(r, Math.min(g, b));

        var h = 0.0;
        var s = 0.0;
        var v = maxv;

        var maxmindif = maxv-minv;

        if (maxv != 0.0) {
            s = maxmindif / maxv;
        }

        if (maxv == r) {
            h = ((g-b) / maxmindif);
        } else if (maxv == g) {
            h = 2.0 + ((b-r) / maxmindif);
        } else if (maxv == b) {
            h = 4.0 + ((r-g) / maxmindif);
        }

        h = h * 0.166666667;

        if(h < 0.0) {
            h = h + 1;
        }

        return [h, s, v];
    }
};
for(var key in extend)
    CanvasRenderingContext2D.prototype[key] = extend[key];
if(!this.G_vmlCanvasManager)
    G_vmlCanvasManager = {init:function(){}, initElement:function(el){return el}};
})();