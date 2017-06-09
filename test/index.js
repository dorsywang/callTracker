var c = function(){
    var f = 1;
};

var b = function(){
    var m = 1;
    c();

    return m;
}

var a = function(){
    var s = 1;

    b();

    c();
}
