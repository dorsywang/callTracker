var fs = require('fs');

var types = require('babel-types');
var babylon = require('babylon');
var traverse = require('babel-traverse').default;

var codes = fs.readFileSync('./test/index.js', {encoding: 'utf-8'});

var ast = babylon.parse(codes, {
    sourceType: "module",
    plugins: [
        'jsx',
        'estree'
    ]
});

console.log(ast);

var treeResult = new Map();

traverse(ast, {
  enter(path) {
        let node = path.node;
        // 这里是调用代码
        if(types.isCallExpression(node)){

            console.log(path);

            // 分析调用function
            var callingName = node.callee.name;

            // 找到父级function
            var funcPaths = path.findParent((path) => path.isFunctionExpression());


            // 从scope中找出是哪个function为调用者
            var findScope = function(scope, name){
                if(scope.bindings[name]){
                    return scope.bindings[name];
                }else{
                    if(scope.parent){
                        return findScope(scope.parent, name);
                    }else{
                        return null;
                    }
                }
            };

            var callingFunction = findScope(path.scope, callingName);

            if(! treeResult.get(callingFunction)){
                treeResult.set(callingFunction, []);
            }

            // A -> [B, C]  A called by->[B, C]
            treeResult.get(callingFunction).push(funcPaths);
        }
   }
});


// 对于var a = function(){}
// function a(){}
// 获取对应的function 名称
var getFunctionName = function(path){
};


var getId = function(){
};


for(var i of treeResult.keys()){
    // 分析树
    var analizeTrackers = function(path){
        var result = [];
        var calledTrackers = treeResult.get(path) || [];

        calledTrackers.map(item => {
            var called = analizeTrackers(item);

            if(called && called.length){
                called.map(i => {
                    i.unshift(item);
                });

                result.push(called);
            }else{
                result.push([item]);
            }

        });

        return result;
    };

    var r = analizeTrackers(i);
    console.log(r);

    var name = i.path.node.id.name;


    console.log('calling', i, treeResult.get(i));
}

//console.log(ast);

