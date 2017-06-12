var b = {};
b.a = function(){
};

b.c = function(){
    b.a();
    this.a();
};
